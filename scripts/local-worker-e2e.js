const { PrismaClient } = require('../node_modules/@prisma/client');
const { Queue } = require('bullmq');
const IORedis = require('ioredis');

const prisma = new PrismaClient();

async function resolveUser() {
  const requestedUserId = process.env.LOCAL_WORKER_TEST_USER_ID?.trim();
  if (requestedUserId) {
    const existing = await prisma.user.findUnique({
      where: { id: requestedUserId },
      select: { id: true, email: true },
    });
    if (!existing) {
      throw new Error(`LOCAL_WORKER_TEST_USER_ID not found: ${requestedUserId}`);
    }
    return existing;
  }

  const suffix = Date.now().toString();
  const userId = `local-worker-user-${suffix}`;
  const email = `local-worker-${suffix}@example.com`;
  return prisma.user.create({
    data: {
      id: userId,
      email,
      plan: 'free',
    },
    select: { id: true, email: true },
  });
}

async function main() {
  const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
  const queueName = process.env.VIDEO_JOBS_QUEUE_NAME || 'sprokl-video-jobs';
  const queueConnection = new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
  const queue = new Queue(queueName, { connection: queueConnection });

  const suffix = Date.now().toString();
  const user = await resolveUser();
  const userId = user.id;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001';

  try {
    const project = await prisma.project.create({
      data: {
        userId,
        name: `Rhode Local Test ${suffix}`,
        productName: 'Rhode Local Test Product',
        productDescription:
          'This is a local end to end worker verification flow for captions background music uploads and browser review.',
        sellingPoints:
          'Fast render flow, stable local queue, clean subtitle validation, reliable upload path.',
        targetAudience: 'Skincare shoppers and internal QA',
        promoEnabled: false,
        selectedAssetIds: [],
        durationSeconds: 18,
        aspectRatio: 'vertical_9_16',
        language: 'en',
        status: 'generating',
      },
    });

    const assets = await Promise.all([
      prisma.asset.create({
        data: {
          userId,
          projectId: project.id,
          type: 'image',
          filename: 'rhode1.png',
          storageUrl: `${appUrl}/characters/rhode1.png`,
          thumbnailUrl: null,
          sizeBytes: BigInt(555013),
          mimeType: 'image/png',
          width: 720,
          height: 1280,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      }),
      prisma.asset.create({
        data: {
          userId,
          projectId: project.id,
          type: 'video',
          filename: 'rhode2.mp4',
          storageUrl: `${appUrl}/characters/rhode2.mp4`,
          thumbnailUrl: null,
          sizeBytes: BigInt(4739013),
          mimeType: 'video/mp4',
          durationSeconds: 10,
          width: 720,
          height: 1280,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      }),
      prisma.asset.create({
        data: {
          userId,
          projectId: project.id,
          type: 'video',
          filename: 'rhode4.mp4',
          storageUrl: `${appUrl}/characters/rhode4.mp4`,
          thumbnailUrl: null,
          sizeBytes: BigInt(5044751),
          mimeType: 'video/mp4',
          durationSeconds: 10,
          width: 720,
          height: 1280,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      }),
    ]);

    await prisma.project.update({
      where: { id: project.id },
      data: {
        selectedAssetIds: assets.map((asset) => asset.id),
      },
    });

    const script = await prisma.script.create({
      data: {
        projectId: project.id,
        styleLabel: 'Rhode Local Variant',
        hookText: 'Meet Rhode Peptide Lip Gloss.',
        bodyText: 'A hydrating glossy lip treatment with peptides, smooth shine, nourishment, and a soft plump finish for everyday wear.',
        ctaText: 'See why beauty conscious young adults keep it in rotation.',
        estimatedDurationSeconds: 18,
        originalHookText: 'Meet Rhode Peptide Lip Gloss.',
        originalBodyText: 'A hydrating glossy lip treatment with peptides, smooth shine, nourishment, and a soft plump finish for everyday wear.',
        originalCtaText: 'See why beauty conscious young adults keep it in rotation.',
        isSelected: true,
        sortOrder: 1,
      },
    });

    const job = await prisma.videoJob.create({
      data: {
        projectId: project.id,
        scriptId: script.id,
        variantIndex: 1,
        status: 'pending',
      },
    });

    await queue.add(
      queueName,
      {
        jobId: job.id,
        projectId: project.id,
        taskId: project.id,
        userId,
        language: 'en',
        aspectRatio: 'vertical_9_16',
        durationSeconds: 18,
        outputFileName: `${project.id}-1.mp4`,
        assets: [
          {
            id: assets[0].id,
            storageUrl: assets[0].storageUrl,
            mimeType: assets[0].mimeType,
            type: assets[0].type,
            animateImage: true,
          },
          {
            id: assets[1].id,
            storageUrl: assets[1].storageUrl,
            mimeType: assets[1].mimeType,
            type: assets[1].type,
            animateImage: true,
          },
          {
            id: assets[2].id,
            storageUrl: assets[2].storageUrl,
            mimeType: assets[2].mimeType,
            type: assets[2].type,
            sourceStartSeconds: 0,
            sourceDurationSeconds: 3,
            sourceClipMaxSeconds: 3,
          },
        ],
        script: {
          styleLabel: script.styleLabel,
          hookText: script.hookText,
          bodyText: script.bodyText,
          ctaText: script.ctaText,
        },
        renderOptions: {
          captionsEnabled: true,
          backgroundMusicEnabled: true,
          stylePreset: 'balanced',
          useHookClip: true,
          animateImages: true,
          shuffleVideoSlices: true,
        },
      },
      {
        jobId: job.id,
        removeOnComplete: 10,
        removeOnFail: 10,
      },
    );

    console.log(
      JSON.stringify(
        {
          userId,
          email: user.email,
          projectId: project.id,
          scriptId: script.id,
          jobId: job.id,
        },
        null,
        2,
      ),
    );
  } finally {
    await queue.close();
    await queueConnection.quit();
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
