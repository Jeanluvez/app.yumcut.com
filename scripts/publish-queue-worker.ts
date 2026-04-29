import path from 'node:path';
import dotenv from 'dotenv';
import { processPublishQueue } from '@/server/publishing/publish-queue-worker';

dotenv.config({
  path: path.resolve(process.cwd(), '.env.local'),
  quiet: true,
});

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  const once = process.argv.includes('--once');
  const publishReady = process.argv.includes('--publish-ready');
  const pollMs = Number(process.env.PUBLISH_QUEUE_WORKER_POLL_MS || 10000);

  do {
    const result = await processPublishQueue({ publishReady });
    console.log(
      `[publish-queue-worker] scanned=${result.scannedProjects} touched=${result.touchedProjects} ready=${result.readyTransitions} published=${result.publishedTransitions} failed=${result.failedTransitions}`,
    );

    if (once) break;
    await sleep(pollMs);
  } while (true);
}

run().catch((error) => {
  console.error('[publish-queue-worker] fatal error', error);
  process.exitCode = 1;
});
