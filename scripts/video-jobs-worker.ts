import path from 'node:path';
import dotenv from 'dotenv';
import { processNextPendingVideoJob } from '@/server/video-jobs/worker';

dotenv.config({
  path: path.resolve(process.cwd(), '.env.local'),
  quiet: true,
});

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  const once = process.argv.includes('--once');
  const pollMs = Number(process.env.VIDEO_JOB_WORKER_POLL_MS || 5000);

  do {
    const result = await processNextPendingVideoJob();
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
