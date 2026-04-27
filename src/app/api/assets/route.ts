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

  const projectIds = Array.from(new Set(items.map((item) => item.projectId).filter((id): id is string => !!id)));
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
  const projectById = new Map(projects.map((project) => [project.id, project] as const));

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
