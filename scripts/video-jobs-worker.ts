import path from 'node:path';
import dotenv from 'dotenv';
import { processNextPendingVideoJob } from '@/server/video-jobs/worker';
import { ensureFfmpegVersion } from './daemon/helpers/ffmpeg';

dotenv.config({
  path: path.resolve(process.cwd(), '.env.local'),
  quiet: true,
});

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readArgValue(flag: string) {
  const index = process.argv.indexOf(flag);
  if (index < 0) return null;
  const value = process.argv[index + 1];
  return value && !value.startsWith('--') ? value : null;
}

async function run() {
  const once = process.argv.includes('--once');
  const pollMs = Number(process.env.VIDEO_JOB_WORKER_POLL_MS || 5000);
  const projectId = readArgValue('--project-id') || process.env.VIDEO_JOB_PROJECT_ID || undefined;

  try {
    await ensureFfmpegVersion();
  } catch (error) {
    if (process.env.VIDEO_JOB_WORKER_STRICT_FFMPEG_CHECK === '1') {
      throw error;
    }
    console.warn('[video-jobs-worker] ffmpeg startup check failed; continuing because VIDEO_JOB_WORKER_STRICT_FFMPEG_CHECK is not enabled');
  }

  do {
    const result = await processNextPendingVideoJob(projectId);
    if (result) {
      console.log(
        `[video-jobs-worker] processed job ${result.id} variant=${result.variantIndex} status=${result.status}`,
      );
    } else {
      console.log('[video-jobs-worker] no pending jobs');
    }

    if (once) break;
    await sleep(pollMs);
  } while (true);
}

run().catch((error) => {
  console.error('[video-jobs-worker] fatal error', error);
  process.exitCode = 1;
});
