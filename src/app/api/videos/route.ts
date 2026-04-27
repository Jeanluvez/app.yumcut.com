import { NextRequest } from 'next/server';
import { withApiError } from '@/server/errors';
import { authenticateApiRequest } from '@/server/api-user';
import { prisma } from '@/server/db';
import { ok, unauthorized } from '@/server/http';

export const GET = withApiError(async function GET(_req: NextRequest) {
  const auth = await authenticateApiRequest(_req);
  if (!auth) return unauthorized();

  const videos = await prisma.video.findMany({
    where: { userId: auth.userId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      variantLabel: true,
      durationSeconds: true,
      fileSizeBytes: true,
      downloadCount: true,
      expiresAt: true,
      createdAt: true,
      project: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  return ok(
    videos.map((video) => ({
      id: video.id,
      variantLabel: video.variantLabel,
      durationSeconds: video.durationSeconds,
      fileSizeBytes: video.fileSizeBytes.toString(),
      downloadCount: video.downloadCount,
      expiresAt: video.expiresAt.toISOString(),
      createdAt: video.createdAt.toISOString(),
      project: {
        id: video.project.id,
        name: video.project.name,
      },
    })),
  );
}, 'Failed to list videos');
