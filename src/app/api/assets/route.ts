import { NextRequest } from 'next/server';
import { z } from 'zod';
import { authenticateApiRequest } from '@/server/api-user';
import { prisma } from '@/server/db';
import { error, notFound, ok, unauthorized } from '@/server/http';
import { withApiError } from '@/server/errors';
import { deleteFileFromSupabaseStorage } from '@/server/supabase-storage';

const querySchema = z.object({
  projectId: z.string().uuid().optional(),
});

export const GET = withApiError(async function GET(req: NextRequest) {
  const auth = await authenticateApiRequest(req);
  if (!auth) return unauthorized();

  const parsed = querySchema.safeParse({
    projectId: req.nextUrl.searchParams.get('projectId') ?? undefined,
  });
  if (!parsed.success) {
    return error('VALIDATION_ERROR', 'Invalid asset query', 400, parsed.error.flatten());
  }

  const items = await prisma.asset.findMany({
    where: {
      userId: auth.userId,
      ...(parsed.data.projectId ? { projectId: parsed.data.projectId } : {}),
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
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
      createdAt: true,
    },
  });

  const projectIds = Array.from(new Set(items.map((item) => item.projectId).filter((id): id is string => !!id)));
  const assetIds = items.map((item) => item.id);
  const projects = projectIds.length > 0
    ? await prisma.project.findMany({
        where: {
          id: { in: projectIds },
          userId: auth.userId,
        },
        select: {
          id: true,
          name: true,
        },
      })
    : [];
  const usageProjects = assetIds.length > 0
    ? await prisma.project.findMany({
        where: {
          userId: auth.userId,
          OR: [
            { selectedAssetIds: { hasSome: assetIds } },
            { hookAssetId: { in: assetIds } },
          ],
        },
        select: {
          selectedAssetIds: true,
          hookAssetId: true,
        },
      })
    : [];
  const projectById = new Map(projects.map((project) => [project.id, project] as const));
  const usageCountByAssetId = new Map<string, number>();

  for (const project of usageProjects) {
    for (const assetId of project.selectedAssetIds) {
      usageCountByAssetId.set(assetId, (usageCountByAssetId.get(assetId) ?? 0) + 1);
    }

    if (project.hookAssetId) {
      usageCountByAssetId.set(project.hookAssetId, (usageCountByAssetId.get(project.hookAssetId) ?? 0) + 1);
    }
  }

  return ok(items.map((item) => ({
    id: item.id,
    projectId: item.projectId,
    type: item.type,
    filename: item.filename,
    storageUrl: item.storageUrl,
    thumbnailUrl: item.thumbnailUrl,
    sizeBytes: item.sizeBytes.toString(),
    mimeType: item.mimeType,
    durationSeconds: item.durationSeconds,
    width: item.width,
    height: item.height,
    expiresAt: item.expiresAt.toISOString(),
    createdAt: item.createdAt.toISOString(),
    usageCount: usageCountByAssetId.get(item.id) ?? 0,
    project: item.projectId
      ? (() => {
          const project = projectById.get(item.projectId);
          return project
            ? {
                id: project.id,
                name: project.name,
              }
            : null;
        })()
      : null,
  })));
}, 'Failed to list assets');

export const DELETE = withApiError(async function DELETE(req: NextRequest) {
  const auth = await authenticateApiRequest(req);
  if (!auth) return unauthorized();

  let json: unknown = {};
  try {
    const text = await req.text();
    json = text.trim().length > 0 ? JSON.parse(text) : {};
  } catch {
    return error('INVALID_JSON', 'Request body must be valid JSON', 400);
  }

  const parsed = z.object({ assetId: z.string().uuid() }).safeParse(json);
  if (!parsed.success) {
    return error('VALIDATION_ERROR', 'Invalid asset delete payload', 400, parsed.error.flatten());
  }

  const asset = await prisma.asset.findFirst({
    where: {
      id: parsed.data.assetId,
      userId: auth.userId,
    },
    select: {
      id: true,
      storageUrl: true,
    },
  });

  if (!asset) return notFound('Asset not found');

  await prisma.$transaction(async (tx) => {
    const projects = await tx.project.findMany({
      where: {
        userId: auth.userId,
        OR: [
          { hookAssetId: asset.id },
          { selectedAssetIds: { has: asset.id } },
        ],
      },
      select: {
        id: true,
        hookAssetId: true,
        selectedAssetIds: true,
      },
    });

    for (const project of projects) {
      await tx.project.update({
        where: { id: project.id },
        data: {
          hookAssetId: project.hookAssetId === asset.id ? null : project.hookAssetId,
          selectedAssetIds: project.selectedAssetIds.filter((id) => id !== asset.id),
        },
      });
    }

    await tx.asset.delete({
      where: { id: asset.id },
    });
  });

  await deleteFileFromSupabaseStorage(asset.storageUrl).catch(() => undefined);

  return ok({ ok: true, id: asset.id });
}, 'Failed to delete asset');
