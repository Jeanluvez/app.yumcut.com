import { NextRequest } from 'next/server';
import { authenticateApiRequest } from '@/server/api-user';
import { prisma } from '@/server/db';
import { notFound, ok, unauthorized } from '@/server/http';
import { withApiError } from '@/server/errors';
import { deleteFileFromSupabaseStorage } from '@/server/supabase-storage';

type Params = { videoId: string };

export const DELETE = withApiError(async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<Params> },
) {
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
    },
  });

  if (!video) return notFound('Video not found');

  await prisma.video.delete({
    where: { id: video.id },
  });

  await deleteFileFromSupabaseStorage(video.storageUrl).catch(() => undefined);

  return ok({ ok: true, id: video.id });
}, 'Failed to delete video');
