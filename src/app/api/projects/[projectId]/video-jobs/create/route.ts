import { NextRequest } from 'next/server';
import { z } from 'zod';
import { authenticateApiRequest } from '@/server/api-user';
import { prisma } from '@/server/db';
import { conflict, error, notFound, ok, unauthorized } from '@/server/http';
import { withApiError } from '@/server/errors';
import { enqueueQueuedVideoJob } from '@/server/video-jobs/queue';

type Params = { projectId: string };

const bodySchema = z.object({
  overwrite: z.boolean().default(true),
});

export const POST = withApiError(async function POST(req: NextRequest, { params }: { params: Promise<Params> }) {
  const auth = await authenticateApiRequest(req);
  if (!auth) return unauthorized();

  let json: unknown = {};
  try {
    const text = await req.text();
    json = text.trim().length > 0 ? JSON.parse(text) : {};
  } catch {
    return error('INVALID_JSON', 'Request body must be valid JSON', 400);
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return error('VALIDATION_ERROR', 'Invalid video job payload', 400, parsed.error.flatten());
  }

  const { projectId } = await params;
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId: auth.userId },
    select: {
      id: true,
      userId: true,
      selectedAssetIds: true,
      hookAssetId: true,
      durationSeconds: true,
      aspectRatio: true,
      language: true,
      promoEnabled: true,
      promoInfo: true,
      scripts: {
        where: { isSelected: true },
        orderBy: { sortOrder: 'asc' },
        select: {
          id: true,
          sortOrder: true,
          styleLabel: true,
          hookText: true,
          bodyText: true,
          ctaText: true,
        },
      },
      videoJobs: {
        select: { id: true, status: true },
      },
    },
  });
  if (!project) return notFound('Project not found');

  if (project.scripts.length === 0) {
    return error('VALIDATION_ERROR', 'Generate and select at least one script first', 400);
  }

  const hasSourceMedia = project.selectedAssetIds.length > 0 || !!project.hookAssetId;
  if (!hasSourceMedia) {
    return error('VALIDATION_ERROR', 'Select at least one asset or hook video before creating jobs', 400);
  }

  const hasActiveJobs = project.videoJobs.some((job) => job.status === 'pending' || job.status === 'processing');
  if (hasActiveJobs && !parsed.data.overwrite) {
    return conflict('Active video jobs already exist for this project');
  }

  if (project.videoJobs.length > 0) {
    await prisma.videoJob.deleteMany({ where: { projectId: project.id } });
  }

  await prisma.videoJob.createMany({
    data: project.scripts.map((script, index) => ({
      projectId: project.id,
      scriptId: script.id,
      variantIndex: index + 1,
      status: 'pending' as const,
    })),
  });

  await prisma.project.update({
    where: { id: project.id },
    data: { status: 'generating' },
  });

  const jobs = await prisma.videoJob.findMany({
    where: { projectId: project.id },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      scriptId: true,
      variantIndex: true,
      status: true,
      retryCount: true,
      errorMessage: true,
      createdAt: true,
      script: {
        select: {
          styleLabel: true,
          sortOrder: true,
          hookText: true,
          bodyText: true,
          ctaText: true,
        },
      },
    },
  });

  const assets = await prisma.asset.findMany({
    where: {
      projectId: project.id,
      userId: auth.userId,
      id: { in: [...project.selectedAssetIds, ...(project.hookAssetId ? [project.hookAssetId] : [])] },
    },
    select: {
      id: true,
      storageUrl: true,
      thumbnailUrl: true,
      type: true,
      filename: true,
      mimeType: true,
    },
  });

  const assetById = new Map(assets.map((asset) => [asset.id, asset] as const));
  const selectedAssets = project.selectedAssetIds
    .map((id) => assetById.get(id))
    .filter((asset): asset is NonNullable<typeof asset> => !!asset)
    .map((asset) => ({
      id: asset.id,
      storageUrl: asset.storageUrl,
      mimeType: asset.mimeType,
      type: asset.type,
      animateImage: asset.type === 'image',
    }));
  const hookAsset = project.hookAssetId ? assetById.get(project.hookAssetId) ?? null : null;
  const renderAssets = [
    ...(hookAsset
      ? [{
          id: hookAsset.id,
          storageUrl: hookAsset.storageUrl,
          mimeType: hookAsset.mimeType,
          type: hookAsset.type,
          animateImage: hookAsset.type === 'image',
        }]
      : []),
    ...selectedAssets,
  ];

  try {
    await Promise.all(
      jobs.map((job) =>
        enqueueQueuedVideoJob({
          jobId: job.id,
          projectId: project.id,
          taskId: project.id,
          userId: project.userId,
          language: project.language,
          aspectRatio: project.aspectRatio,
          durationSeconds: project.durationSeconds,
          outputFileName: `${project.id}-${job.variantIndex}.mp4`,
          assets: renderAssets,
          script: {
            styleLabel: job.script.styleLabel || `Variant ${job.variantIndex}`,
            hookText: job.script.hookText,
            bodyText: job.script.bodyText,
            ctaText: job.script.ctaText,
          },
          promoEnabled: project.promoEnabled,
          promoInfo: (project.promoInfo as Record<string, unknown> | null) ?? null,
          renderOptions: {
            captionsEnabled: true,
            backgroundMusicEnabled: true,
            stylePreset: 'balanced',
            useHookClip: true,
            animateImages: true,
            shuffleVideoSlices: true,
          },
        }),
      ),
    );
  } catch (enqueueError) {
    await prisma.videoJob.deleteMany({ where: { projectId: project.id } });
    await prisma.project.update({
      where: { id: project.id },
      data: { status: 'draft' },
    });
    throw enqueueError;
  }

  return ok({
    jobs: jobs.map((job) => ({
      id: job.id,
      scriptId: job.scriptId,
      variantIndex: job.variantIndex,
      status: job.status,
      retryCount: job.retryCount,
      errorMessage: job.errorMessage,
      styleLabel: job.script.styleLabel,
      sortOrder: job.script.sortOrder,
      createdAt: job.createdAt.toISOString(),
    })),
  }, { status: 201 });
}, 'Failed to create video jobs');
