import { NextRequest } from 'next/server';
import { z } from 'zod';
import { authenticateApiRequest } from '@/server/api-user';
import { prisma } from '@/server/db';
import { error, ok, unauthorized } from '@/server/http';
import { withApiError } from '@/server/errors';

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
  })));
}, 'Failed to list assets');
