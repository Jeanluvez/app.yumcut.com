import { NextRequest } from 'next/server';
import { z } from 'zod';
import { authenticateApiRequest } from '@/server/api-user';
import { prisma } from '@/server/db';
import { error, notFound, ok, unauthorized } from '@/server/http';
import { withApiError } from '@/server/errors';

type Params = { projectId: string };

const bodySchema = z.object({
  assetIds: z.array(z.string().uuid()).min(1).max(50),
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
    return error('VALIDATION_ERROR', 'Invalid asset import payload', 400, parsed.error.flatten());
  }

  const { projectId } = await params;
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId: auth.userId },
    select: { id: true },
  });
  if (!project) return notFound('Project not found');

  const assetIds = Array.from(new Set(parsed.data.assetIds));
  const assets = await prisma.asset.findMany({
    where: {
      id: { in: assetIds },
      userId: auth.userId,
      type: { not: 'hook' },
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
  const missingIds = assetIds.filter((id) => !foundIds.has(id));
  if (missingIds.length > 0) {
    return error('VALIDATION_ERROR', 'One or more assets could not be imported', 400, { missingAssetIds: missingIds });
  }

  const clonedAssetIdBySourceId = new Map<string, string>();
  await prisma.$transaction(async (tx) => {
    for (const asset of assets) {
      if (asset.projectId === project.id) continue;

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
        select: { id: true },
      });

      clonedAssetIdBySourceId.set(asset.id, cloned.id);
    }

    const resolvedSelectedAssetIds = assetIds.map((id) => clonedAssetIdBySourceId.get(id) ?? id);

    await tx.project.update({
      where: { id: project.id },
      data: {
        selectedAssetIds: resolvedSelectedAssetIds,
      },
    });
  });

  const resolvedSelectedAssetIds = assetIds.map((id) => clonedAssetIdBySourceId.get(id) ?? id);

  return ok({
    selectedAssetIds: resolvedSelectedAssetIds,
  });
}, 'Failed to import project assets');
