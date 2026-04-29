import { prisma } from '@/server/db';

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

export type PublishQueueWorkerOptions = {
  publishReady?: boolean;
  limitProjects?: number;
};

export type PublishQueueWorkerResult = {
  scannedProjects: number;
  readyTransitions: number;
  publishedTransitions: number;
  failedTransitions: number;
  touchedProjects: number;
};

function readQueue(promoInfo: unknown): PublishQueueItem[] {
  if (!promoInfo || typeof promoInfo !== 'object' || !('publishQueue' in promoInfo)) {
    return [];
  }
  const queue = (promoInfo as { publishQueue?: unknown }).publishQueue;
  return Array.isArray(queue) ? (queue as PublishQueueItem[]) : [];
}

function buildMockProviderPostId(item: PublishQueueItem, now: Date) {
  const itemId = item.id?.trim() || item.videoId?.trim() || 'publish-task';
  return `${item.platform ?? 'tiktok'}-${itemId}-${now.getTime()}`;
}

export async function processPublishQueue(options: PublishQueueWorkerOptions = {}): Promise<PublishQueueWorkerResult> {
  const now = new Date();
  const nowIso = now.toISOString();
  const projects = await prisma.project.findMany({
    orderBy: { createdAt: 'asc' },
    take: options.limitProjects,
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

  let readyTransitions = 0;
  let publishedTransitions = 0;
  let failedTransitions = 0;
  let touchedProjects = 0;

  for (const project of projects) {
    const queue = readQueue(project.promoInfo);
    if (queue.length === 0) continue;

    const availableVideoIds = new Set(project.videos.map((video) => video.id));
    const availableChannels = new Map(project.user.channels.map((channel) => [channel.id, channel.status]));
    let projectChanged = false;

    const nextQueue = queue.map((item) => {
      const nextItem = { ...item };
      const status = nextItem.status ?? 'draft';
      const publishAtMs = nextItem.publishAt ? Date.parse(nextItem.publishAt) : Number.NaN;

      if (status === 'scheduled' && Number.isFinite(publishAtMs) && publishAtMs <= now.getTime()) {
        nextItem.status = 'ready';
        nextItem.updatedAt = nowIso;
        projectChanged = true;
        readyTransitions += 1;
      }

      if (options.publishReady && nextItem.status === 'ready') {
        nextItem.lastAttemptAt = nowIso;
        const hasVideo = typeof nextItem.videoId === 'string' && availableVideoIds.has(nextItem.videoId);
        const channelStatus = nextItem.channelId ? availableChannels.get(nextItem.channelId) : 'connected';
        if (!hasVideo) {
          nextItem.status = 'failed';
          nextItem.errorMessage = 'Linked video could not be found for this publish task.';
          nextItem.publishedAt = null;
          nextItem.providerPostId = null;
          nextItem.publishedUrl = null;
          nextItem.updatedAt = nowIso;
          projectChanged = true;
          failedTransitions += 1;
          return nextItem;
        }
        if (nextItem.channelId && channelStatus !== 'connected') {
          nextItem.status = 'failed';
          nextItem.errorMessage = 'Linked channel is disconnected.';
          nextItem.publishedAt = null;
          nextItem.providerPostId = null;
          nextItem.publishedUrl = null;
          nextItem.updatedAt = nowIso;
          projectChanged = true;
          failedTransitions += 1;
          return nextItem;
        }
        nextItem.status = 'published';
        nextItem.publishedAt = nowIso;
        nextItem.providerPostId = buildMockProviderPostId(nextItem, now);
        nextItem.publishedUrl = null;
        nextItem.errorMessage = null;
        nextItem.updatedAt = nowIso;
        projectChanged = true;
        publishedTransitions += 1;
      }

      return nextItem;
    });

    if (!projectChanged) continue;

    touchedProjects += 1;
    await prisma.project.update({
      where: { id: project.id },
      data: {
        promoInfo: {
          ...((project.promoInfo && typeof project.promoInfo === 'object') ? project.promoInfo as Record<string, unknown> : {}),
          publishQueue: nextQueue,
        },
      },
    });
  }

  return {
    scannedProjects: projects.length,
    readyTransitions,
    publishedTransitions,
    failedTransitions,
    touchedProjects,
  };
}
