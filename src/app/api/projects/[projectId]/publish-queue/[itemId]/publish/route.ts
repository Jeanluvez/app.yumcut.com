import { NextRequest } from 'next/server';
import { authenticateApiRequest } from '@/server/api-user';
import { prisma } from '@/server/db';
import { error, notFound, ok, unauthorized } from '@/server/http';
import { withApiError } from '@/server/errors';

type Params = {
  projectId: string;
  itemId: string;
};

type PublishQueueItem = {
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
};

function buildMockProviderPostId(item: PublishQueueItem, now: Date) {
  const itemId = item.id?.trim() || item.videoId?.trim() || 'publish-task';
  return `${item.platform ?? 'tiktok'}-${itemId}-${now.getTime()}`;
}

export const POST = withApiError(async function POST(req: NextRequest, { params }: { params: Promise<Params> }) {
  const auth = await authenticateApiRequest(req);
  if (!auth) return unauthorized();

  const { projectId, itemId } = await params;
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId: auth.userId },
    select: {
      id: true,
      promoInfo: true,
      videos: {
        select: { id: true },
      },
      user: {
        select: {
          channels: {
            select: { id: true, status: true },
          },
        },
      },
    },
  });

  if (!project) return notFound('Project not found');

  const queue = project.promoInfo && typeof project.promoInfo === 'object' && 'publishQueue' in project.promoInfo
    ? ((project.promoInfo as { publishQueue?: PublishQueueItem[] }).publishQueue ?? [])
    : [];

  const queueItem = queue.find((item) => item?.id === itemId);
  if (!queueItem) return notFound('Publish task not found');

  if (queueItem.status === 'published') {
    return error('VALIDATION_ERROR', 'This publish task has already been published.', 400);
  }

  const nowIso = new Date().toISOString();
  const videoExists = project.videos.some((video) => video.id === queueItem.videoId);
  const channelStatus = queueItem.channelId ? project.user?.channels.find((channel) => channel.id === queueItem.channelId)?.status : 'connected';
  const nextQueue = queue.map((item) => {
    if (item?.id !== itemId) return item;
    if (!videoExists) {
      return {
        ...item,
        status: 'failed' as const,
        publishedAt: null,
        providerPostId: null,
        publishedUrl: null,
        lastAttemptAt: nowIso,
        errorMessage: 'Linked video could not be found for this publish task.',
        updatedAt: nowIso,
      };
    }
    if (item.channelId && channelStatus !== 'connected') {
      return {
        ...item,
        status: 'failed' as const,
        publishedAt: null,
        providerPostId: null,
        publishedUrl: null,
        lastAttemptAt: nowIso,
        errorMessage: 'Linked channel is disconnected.',
        updatedAt: nowIso,
      };
    }
    return {
      ...item,
      status: 'published' as const,
      publishedAt: nowIso,
      providerPostId: buildMockProviderPostId(item, new Date(nowIso)),
      publishedUrl: null,
      lastAttemptAt: nowIso,
      errorMessage: null,
      updatedAt: nowIso,
    };
  });

  const nextPromoInfo = {
    ...((project.promoInfo && typeof project.promoInfo === 'object') ? project.promoInfo as Record<string, unknown> : {}),
    publishQueue: nextQueue,
  };

  await prisma.project.update({
    where: { id: project.id },
    data: { promoInfo: nextPromoInfo },
  });

  if (!videoExists) {
    return error('PUBLISH_FAILED', 'Linked video could not be found. The publish task was marked as failed.', 400);
  }
  if (queueItem.channelId && channelStatus !== 'connected') {
    return error('PUBLISH_FAILED', 'Linked channel is disconnected. The publish task was marked as failed.', 400);
  }

  return ok({
    ok: true,
    itemId,
    status: 'published',
    publishedAt: nowIso,
  });
}, 'Failed to publish queue item');
