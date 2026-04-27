import { NextRequest } from 'next/server';
import { authenticateApiRequest } from '@/server/api-user';
import { prisma } from '@/server/db';
import { notFound, ok, unauthorized } from '@/server/http';
import { withApiError } from '@/server/errors';

type Params = { projectId: string };

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
            createdAt: true,
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
    promoInfo: project.promoInfo,
    selectedAssetIds: project.selectedAssetIds,
    hookAssetId: project.hookAssetId,
    durationSeconds: project.durationSeconds,
    aspectRatio: project.aspectRatio,
    language: project.language,
    status: project.status,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
    counts: {
      assets: assetCount,
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
    videos: project.videos.map((video) => ({
      id: video.id,
      storageUrl: video.storageUrl,
      thumbnailUrl: video.thumbnailUrl,
      variantLabel: video.variantLabel,
      durationSeconds: video.durationSeconds,
      createdAt: video.createdAt.toISOString(),
    })),
  });
}, 'Failed to load project');

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
