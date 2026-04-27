import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/server/api-user';
import { prisma } from '@/server/db';
import { notFound, unauthorized } from '@/server/http';
import { withApiError } from '@/server/errors';

type Params = { videoId: string };

export const GET = withApiError(async function GET(req: NextRequest, { params }: { params: Promise<Params> }) {
  const auth = await authenticateApiRequest(req);
  if (!auth) return unauthorized();

  const { videoId } = await params;
  const video = await prisma.video.findFirst({
    where: {
      id: videoId,
      userId: auth.userId,
    },
    select: {
      id: true,
      storageUrl: true,
      expiresAt: true,
    },
  });

  if (!video) return notFound('Video not found');
  if (video.expiresAt.getTime() <= Date.now()) {
    return notFound('Video has expired');
  }

  await prisma.video.update({
    where: { id: video.id },
    data: {
      downloadCount: {
        increment: 1,
      },
    },
  });

  return NextResponse.redirect(video.storageUrl, { status: 307 });
}, 'Failed to download video');
