import { NextRequest } from 'next/server';
import { authenticateApiRequest } from '@/server/api-user';
import { prisma } from '@/server/db';
import { error, notFound, ok, unauthorized } from '@/server/http';
import { withApiError } from '@/server/errors';
import { z } from 'zod';
import { deriveProjectDisplayStatus } from '@/shared/project-status';

type Params = { projectId: string };

const updateProjectAssetsSchema = z.object({
  selectedAssetIds: z.array(z.string().uuid()).max(50).optional(),
  hookAssetId: z.string().uuid().nullable().optional(),
  promoEnabled: z.boolean().optional(),
  promoInfo: z.object({
    originalPrice: z.string().trim().max(80).optional(),
    salePrice: z.string().trim().max(80).optional(),
    discountLabel: z.string().trim().max(160).optional(),
  }).optional(),
  renderOptions: z.object({
    captionsEnabled: z.boolean().optional(),
    backgroundMusicEnabled: z.boolean().optional(),
    stylePreset: z.enum(['balanced', 'punchy', 'calm']).optional(),
    useHookClip: z.boolean().optional(),
    animateImages: z.boolean().optional(),
    shuffleVideoSlices: z.boolean().optional(),
  }).optional(),
  publishQueue: z.array(z.object({
    id: z.string().min(1).max(80),
    videoId: z.string().uuid(),
    platform: z.enum(['tiktok', 'instagram_reels', 'youtube_shorts']).optional().default('tiktok'),
    channelId: z.string().uuid().nullable().optional(),
    title: z.string().trim().min(1).max(160),
    description: z.string().trim().max(2000).optional().default(''),
    publishAt: z.string().datetime(),
    status: z.enum(['draft', 'scheduled', 'ready', 'published', 'failed']),
    publishedAt: z.string().datetime().nullable().optional(),
    providerPostId: z.string().trim().max(191).nullable().optional(),
    publishedUrl: z.string().trim().max(2000).nullable().optional(),
    lastAttemptAt: z.string().datetime().nullable().optional(),
    errorMessage: z.string().trim().max(500).nullable().optional(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })).max(50).optional(),
});

function derivePublishQueueStatus(item: {
  status?: 'draft' | 'scheduled' | 'ready' | 'published' | 'failed';
  publishAt?: string;
}) {
  if (item.status === 'published') return 'published' as const;
  if (item.status === 'failed') return 'failed' as const;
  if (item.status === 'ready') return 'ready' as const;
  if (item.status === 'scheduled') {
    const publishAt = item.publishAt ? Date.parse(item.publishAt) : Number.NaN;
    if (Number.isFinite(publishAt) && publishAt <= Date.now()) {
      return 'ready' as const;
    }
    return 'scheduled' as const;
  }
  return 'draft' as const;
}

function normalizeProjectPromoInfo(promoEnabled: boolean, promoInfo: unknown) {
  if (!promoEnabled || !promoInfo || typeof promoInfo !== 'object') {
    return {
      originalPrice: '',
      salePrice: '',
      discountLabel: '',
    };
  }

  const raw = promoInfo as Record<string, unknown>;
  return {
    originalPrice: typeof raw.originalPrice === 'string' ? raw.originalPrice : '',
    salePrice: typeof raw.salePrice === 'string' ? raw.salePrice : '',
    discountLabel:
      typeof raw.discountLabel === 'string'
        ? raw.discountLabel
        : typeof raw.offerText === 'string'
          ? raw.offerText
          : '',
  };
}

function normalizeProjectRenderOptions(promoInfo: unknown) {
  const renderOptions =
    promoInfo && typeof promoInfo === 'object' && 'renderOptions' in promoInfo
      ? (promoInfo as {
          renderOptions?: {
            captionsEnabled?: boolean;
            backgroundMusicEnabled?: boolean;
            stylePreset?: 'balanced' | 'punchy' | 'calm';
            useHookClip?: boolean;
            animateImages?: boolean;
            shuffleVideoSlices?: boolean;
          };
        }).renderOptions
      : null;

  return {
    captionsEnabled: renderOptions?.captionsEnabled !== false,
    backgroundMusicEnabled: renderOptions?.backgroundMusicEnabled !== false,
    stylePreset: renderOptions?.stylePreset ?? 'balanced',
    useHookClip: renderOptions?.useHookClip !== false,
    animateImages: renderOptions?.animateImages !== false,
    shuffleVideoSlices: renderOptions?.shuffleVideoSlices !== false,
  };
}

function normalizeProjectPublishQueue(promoInfo: unknown) {
  const queue =
    promoInfo && typeof promoInfo === 'object' && 'publishQueue' in promoInfo
      ? (promoInfo as {
          publishQueue?: Array<{
            id?: string;
            videoId?: string;
            platform?: 'tiktok' | 'instagram_reels' | 'youtube_shorts';
            channelId?: string | null;
            title?: string;
            description?: string;
            publishAt?: string;
            status?: 'draft' | 'scheduled' | 'ready' | 'published' | 'failed';
            publishedAt?: string | null;
            providerPostId?: string | null;
            publishedUrl?: string | null;
            lastAttemptAt?: string | null;
            errorMessage?: string | null;
            createdAt?: string;
            updatedAt?: string;
          }>;
        }).publishQueue
      : null;

  if (!Array.isArray(queue)) return [];

  return queue
    .filter((item) => item && typeof item === 'object' && typeof item.videoId === 'string')
    .map((item) => ({
      id: item.id ?? '',
      videoId: item.videoId ?? '',
      platform: item.platform ?? 'tiktok',
      channelId: item.channelId ?? null,
      title: item.title ?? '',
      description: item.description ?? '',
      publishAt: item.publishAt ?? '',
      status: derivePublishQueueStatus(item),
      publishedAt: item.publishedAt ?? null,
      providerPostId: item.providerPostId ?? null,
      publishedUrl: item.publishedUrl ?? null,
      lastAttemptAt: item.lastAttemptAt ?? null,
      errorMessage: item.errorMessage ?? null,
      createdAt: item.createdAt ?? item.publishAt ?? '',
      updatedAt: item.updatedAt ?? item.publishAt ?? '',
    }));
}

export const GET = withApiError(async function GET(req: NextRequest, { params }: { params: Promise<Params> }) {
  const auth = await authenticateApiRequest(req);
  if (!auth) return unauthorized();

  const { projectId } = await params;
  const [project, assetCount] = await Promise.all([
    prisma.project.findFirst({
      where: { id: projectId, userId: auth.userId },
      select: {
        id: true,
        userId: true,
        name: true,
        productName: true,
        productDescription: true,
        sellingPoints: true,
        targetAudience: true,
        promoEnabled: true,
        promoInfo: true,
        selectedAssetIds: true,
        hookAssetId: true,
        durationSeconds: true,
        aspectRatio: true,
        language: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        scripts: {
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true,
            styleLabel: true,
            hookText: true,
            bodyText: true,
            ctaText: true,
            isSelected: true,
            sortOrder: true,
            createdAt: true,
          },
        },
        videos: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            storageUrl: true,
            thumbnailUrl: true,
            variantLabel: true,
            durationSeconds: true,
            fileSizeBytes: true,
            downloadCount: true,
            expiresAt: true,
            createdAt: true,
          },
        },
        videoJobs: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            scriptId: true,
            variantIndex: true,
            status: true,
            retryCount: true,
            errorMessage: true,
            voiceoverUrl: true,
            ttsTimestampsUrl: true,
            finalUrl: true,
            createdAt: true,
            startedAt: true,
            completedAt: true,
            script: {
              select: {
                styleLabel: true,
                sortOrder: true,
              },
            },
          },
        },
        _count: {
          select: {
            scripts: true,
            videoJobs: true,
            videos: true,
          },
        },
      },
    }),
    prisma.asset.count({
      where: {
        userId: auth.userId,
        projectId,
      },
    }),
  ]);

  if (!project) return notFound('Project not found');

  return ok({
    id: project.id,
    userId: project.userId,
    title: project.name,
    name: project.name,
    productName: project.productName,
    productDescription: project.productDescription,
    sellingPoints: project.sellingPoints,
    targetAudience: project.targetAudience,
    promoEnabled: project.promoEnabled,
    promoInfo: normalizeProjectPromoInfo(project.promoEnabled, project.promoInfo),
    renderOptions: normalizeProjectRenderOptions(project.promoInfo),
    publishQueue: normalizeProjectPublishQueue(project.promoInfo),
    selectedAssetIds: project.selectedAssetIds,
    hookAssetId: project.hookAssetId,
    durationSeconds: project.durationSeconds,
    aspectRatio: project.aspectRatio,
    language: project.language,
    status: deriveProjectDisplayStatus({
      projectStatus: project.status,
      videoJobs: project.videoJobs,
    }),
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
    counts: {
      assets: project.selectedAssetIds.length,
      uploadedAssets: assetCount,
      scripts: project._count.scripts,
      videoJobs: project._count.videoJobs,
      videos: project._count.videos,
    },
    scripts: project.scripts.map((script) => ({
      id: script.id,
      styleLabel: script.styleLabel,
      hookText: script.hookText,
      bodyText: script.bodyText,
      ctaText: script.ctaText,
      isSelected: script.isSelected,
      sortOrder: script.sortOrder,
      createdAt: script.createdAt.toISOString(),
    })),
    videoJobs: project.videoJobs.map((job) => ({
      id: job.id,
      scriptId: job.scriptId,
      variantIndex: job.variantIndex,
      status: job.status,
      retryCount: job.retryCount,
      errorMessage: job.errorMessage,
      voiceoverUrl: job.voiceoverUrl,
      ttsTimestampsUrl: job.ttsTimestampsUrl,
      finalUrl: job.finalUrl,
      styleLabel: job.script.styleLabel,
      sortOrder: job.script.sortOrder,
      createdAt: job.createdAt.toISOString(),
      startedAt: job.startedAt ? job.startedAt.toISOString() : null,
      completedAt: job.completedAt ? job.completedAt.toISOString() : null,
    })),
    videos: project.videos.map((video) => ({
      id: video.id,
      storageUrl: video.storageUrl,
      thumbnailUrl: video.thumbnailUrl,
      variantLabel: video.variantLabel,
      durationSeconds: video.durationSeconds,
      fileSizeBytes: video.fileSizeBytes.toString(),
      downloadCount: video.downloadCount,
      expiresAt: video.expiresAt.toISOString(),
      createdAt: video.createdAt.toISOString(),
    })),
  });
}, 'Failed to load project');

export const PATCH = withApiError(async function PATCH(req: NextRequest, { params }: { params: Promise<Params> }) {
  const auth = await authenticateApiRequest(req);
  if (!auth) return unauthorized();

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return error('INVALID_JSON', 'Request body must be valid JSON', 400);
  }

  const parsed = updateProjectAssetsSchema.safeParse(json);
  if (!parsed.success) {
    return error('VALIDATION_ERROR', 'Invalid project update payload', 400, parsed.error.flatten());
  }

  const { projectId } = await params;
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId: auth.userId },
    select: { id: true },
  });
  if (!project) return notFound('Project not found');

  let selectedAssetIds = Array.from(new Set(parsed.data.selectedAssetIds ?? []));
  let hookAssetId = parsed.data.hookAssetId === undefined ? undefined : parsed.data.hookAssetId;
  const promoEnabled = parsed.data.promoEnabled;
  const promoInfoPatch = parsed.data.promoInfo;
  const renderOptionsPatch = parsed.data.renderOptions;
  const publishQueuePatch = parsed.data.publishQueue;
  const allRequestedIds = Array.from(new Set([
    ...selectedAssetIds,
    ...(hookAssetId ? [hookAssetId] : []),
  ]));

  if (allRequestedIds.length > 0) {
    const assets = await prisma.asset.findMany({
      where: {
        id: { in: allRequestedIds },
        userId: auth.userId,
      },
      select: {
        id: true,
        userId: true,
        projectId: true,
        type: true,
        filename: true,
        storageUrl: true,
        thumbnailUrl: true,
        sizeBytes: true,
        mimeType: true,
        durationSeconds: true,
        width: true,
        height: true,
        expiresAt: true,
      },
    });
    const foundIds = new Set(assets.map((asset) => asset.id));
    const missingIds = allRequestedIds.filter((id) => !foundIds.has(id));
    if (missingIds.length > 0) {
      return error('VALIDATION_ERROR', 'One or more assets do not belong to your account', 400, { missingAssetIds: missingIds });
    }

    const clonedAssetIdBySourceId = new Map<string, string>();
    const resolvedAssets = await prisma.$transaction(async (tx) => {
      const resolved: Array<{ id: string; type: string }> = [];

      for (const asset of assets) {
        if (asset.projectId === project.id) {
          resolved.push({ id: asset.id, type: asset.type });
          continue;
        }

        const cloned = await tx.asset.create({
          data: {
            userId: auth.userId,
            projectId: project.id,
            type: asset.type,
            filename: asset.filename,
            storageUrl: asset.storageUrl,
            thumbnailUrl: asset.thumbnailUrl,
            sizeBytes: asset.sizeBytes,
            mimeType: asset.mimeType,
            durationSeconds: asset.durationSeconds,
            width: asset.width,
            height: asset.height,
            expiresAt: asset.expiresAt,
          },
          select: { id: true, type: true },
        });

        clonedAssetIdBySourceId.set(asset.id, cloned.id);
        resolved.push(cloned);
      }

      return resolved;
    });

    selectedAssetIds = selectedAssetIds.map((id) => clonedAssetIdBySourceId.get(id) ?? id);
    hookAssetId =
      hookAssetId === undefined
        ? undefined
        : hookAssetId === null
          ? null
          : clonedAssetIdBySourceId.get(hookAssetId) ?? hookAssetId;

    const hookAsset = hookAssetId ? resolvedAssets.find((asset) => asset.id === hookAssetId) : null;
    if (hookAsset && hookAsset.type !== 'hook') {
      return error('VALIDATION_ERROR', 'Hook asset must use asset type "hook"', 400);
    }

    const invalidSelected = resolvedAssets.filter((asset) => selectedAssetIds.includes(asset.id) && asset.type === 'hook');
    if (invalidSelected.length > 0) {
      return error('VALIDATION_ERROR', 'Hook assets cannot be added to selected asset IDs', 400, {
        invalidSelectedAssetIds: invalidSelected.map((asset) => asset.id),
      });
    }
  }

  const existingProject = await prisma.project.findUnique({
    where: { id: project.id },
    select: { promoInfo: true },
  });

  const nextPromoInfo = renderOptionsPatch || promoInfoPatch
    ? {
        ...((existingProject?.promoInfo && typeof existingProject.promoInfo === 'object')
          ? existingProject.promoInfo as Record<string, unknown>
          : {}),
        ...(promoInfoPatch
          ? {
              originalPrice: promoInfoPatch.originalPrice ?? '',
              salePrice: promoInfoPatch.salePrice ?? '',
              discountLabel: promoInfoPatch.discountLabel ?? '',
              offerText: promoInfoPatch.discountLabel ?? '',
            }
          : {}),
        renderOptions: {
          ...(
            existingProject?.promoInfo &&
            typeof existingProject.promoInfo === 'object' &&
            'renderOptions' in existingProject.promoInfo
              ? ((existingProject.promoInfo as { renderOptions?: Record<string, unknown> }).renderOptions ?? {})
              : {}
          ),
          ...renderOptionsPatch,
        },
      }
    : undefined;

  const mergedPromoInfo =
    nextPromoInfo !== undefined || publishQueuePatch !== undefined
      ? {
          ...((nextPromoInfo ?? (
            (existingProject?.promoInfo && typeof existingProject.promoInfo === 'object')
              ? existingProject.promoInfo as Record<string, unknown>
              : {}
          )) as Record<string, unknown>),
          ...(publishQueuePatch !== undefined ? { publishQueue: publishQueuePatch } : {}),
        }
      : undefined;

  const updated = await prisma.project.update({
    where: { id: project.id },
    data: {
      ...(parsed.data.selectedAssetIds !== undefined ? { selectedAssetIds } : {}),
      ...(hookAssetId !== undefined ? { hookAssetId } : {}),
      ...(promoEnabled !== undefined ? { promoEnabled } : {}),
      ...(mergedPromoInfo !== undefined ? { promoInfo: mergedPromoInfo } : {}),
    },
    select: {
      id: true,
      selectedAssetIds: true,
      hookAssetId: true,
      promoEnabled: true,
      promoInfo: true,
      updatedAt: true,
    },
  });

  return ok({
    id: updated.id,
    selectedAssetIds: updated.selectedAssetIds,
    hookAssetId: updated.hookAssetId,
    promoEnabled: updated.promoEnabled,
    promoInfo: normalizeProjectPromoInfo(updated.promoEnabled, updated.promoInfo),
    renderOptions: normalizeProjectRenderOptions(updated.promoInfo),
    publishQueue: normalizeProjectPublishQueue(updated.promoInfo),
    updatedAt: updated.updatedAt.toISOString(),
  });
}, 'Failed to update project');

export const DELETE = withApiError(async function DELETE(req: NextRequest, { params }: { params: Promise<Params> }) {
  const auth = await authenticateApiRequest(req);
  if (!auth) return unauthorized();

  const { projectId } = await params;
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId: auth.userId },
    select: { id: true },
  });

  if (!project) return notFound('Project not found');

  await prisma.project.delete({ where: { id: project.id } });
  return ok({ ok: true });
}, 'Failed to delete project');
