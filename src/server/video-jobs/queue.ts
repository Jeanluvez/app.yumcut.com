import IORedis from 'ioredis';
import { Queue } from 'bullmq';
import { config } from '@/server/config';

type CreateQueuedVideoJobInput = {
  jobId: string;
  projectId: string;
  taskId: string;
  userId: string;
  language: 'en' | 'es';
  aspectRatio: 'vertical_9_16' | 'square_1_1' | 'horizontal_16_9';
  durationSeconds: number;
  outputFileName: string;
  assets: Array<{
    id: string;
    storageUrl: string;
    mimeType: string;
    type: 'video' | 'image' | 'hook';
    animateImage?: boolean;
    sourceStartSeconds?: number;
    sourceDurationSeconds?: number;
    sourceClipMaxSeconds?: number;
  }>;
  script: {
    styleLabel: string;
    hookText: string;
    bodyText: string;
    ctaText: string;
  };
  promoEnabled?: boolean;
  promoInfo?: Record<string, unknown> | null;
  renderOptions?: {
    captionsEnabled?: boolean;
    backgroundMusicEnabled?: boolean;
    stylePreset?: 'balanced' | 'punchy' | 'calm';
    useHookClip?: boolean;
    animateImages?: boolean;
    shuffleVideoSlices?: boolean;
  };
};

let queue: Queue | null = null;
let connection: IORedis | null = null;

function getRedisConnection() {
  if (!config.REDIS_URL) {
    throw new Error('REDIS_URL is not configured');
  }

  if (!connection) {
    connection = new IORedis(config.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
  }

  return connection;
}

export function getVideoJobsQueue() {
  if (!queue) {
    queue = new Queue(config.VIDEO_JOBS_QUEUE_NAME, {
      connection: getRedisConnection(),
    });
  }

  return queue;
}

export async function enqueueQueuedVideoJob(job: CreateQueuedVideoJobInput) {
  if (!config.REDIS_URL) {
    throw new Error('REDIS_URL is not configured');
  }

  const videoQueue = getVideoJobsQueue();
  await videoQueue.add(
    config.VIDEO_JOBS_QUEUE_NAME,
    {
      ...job,
      queuedAt: new Date().toISOString(),
    },
    {
      jobId: job.jobId,
      removeOnComplete: 500,
      removeOnFail: 500,
    },
  );

  return { enqueued: true as const };
}
