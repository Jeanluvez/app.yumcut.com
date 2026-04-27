import { prisma } from '@/server/db';

type ClaimedVideoJob = Awaited<ReturnType<typeof claimNextPendingVideoJob>>;

export async function claimNextPendingVideoJob(projectId?: string) {
  const candidate = await prisma.videoJob.findFirst({
    where: {
      status: 'pending',
      ...(projectId ? { projectId } : {}),
    },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      projectId: true,
      scriptId: true,
      variantIndex: true,
      status: true,
      retryCount: true,
      createdAt: true,
      project: {
        select: {
          id: true,
          userId: true,
          selectedAssetIds: true,
          hookAssetId: true,
          durationSeconds: true,
        },
      },
      script: {
        select: {
          id: true,
          styleLabel: true,
          hookText: true,
          bodyText: true,
          ctaText: true,
          sortOrder: true,
        },
      },
    },
  });

  if (!candidate) return null;

  const now = new Date();
  const claimed = await prisma.videoJob.updateMany({
    where: {
      id: candidate.id,
      status: 'pending',
    },
    data: {
      status: 'processing',
      startedAt: now,
      errorMessage: null,
    },
  });

  if (claimed.count === 0) return null;

  return prisma.videoJob.findUnique({
    where: { id: candidate.id },
    select: {
      id: true,
      projectId: true,
      scriptId: true,
      variantIndex: true,
      status: true,
      retryCount: true,
      errorMessage: true,
      createdAt: true,
      startedAt: true,
      completedAt: true,
      project: {
        select: {
          id: true,
          userId: true,
          selectedAssetIds: true,
          hookAssetId: true,
          durationSeconds: true,
        },
      },
      script: {
        select: {
          id: true,
          styleLabel: true,
          hookText: true,
          bodyText: true,
          ctaText: true,
          sortOrder: true,
        },
      },
    },
  });
}

async function updateProjectTerminalStatus(projectId: string) {
  const jobs = await prisma.videoJob.findMany({
    where: { projectId },
    select: { status: true },
  });

  if (jobs.length === 0) return;

  const hasActive = jobs.some((job) => job.status === 'pending' || job.status === 'processing');
  if (hasActive) {
    await prisma.project.update({
      where: { id: projectId },
      data: { status: 'generating' },
    });
    return;
  }

  const hasFailure = jobs.some((job) => job.status === 'failed');
  await prisma.project.update({
    where: { id: projectId },
    data: { status: hasFailure ? 'failed' : 'done' },
  });
}

export async function markVideoJobDone(jobId: string) {
  const job = await prisma.videoJob.update({
    where: { id: jobId },
    data: {
      status: 'done',
      completedAt: new Date(),
      errorMessage: null,
      finalUrl: `mock://video-jobs/${jobId}/final.mp4`,
    },
    select: {
      id: true,
      projectId: true,
      variantIndex: true,
      status: true,
      finalUrl: true,
      completedAt: true,
    },
  });

  await updateProjectTerminalStatus(job.projectId);
  return job;
}

export async function markVideoJobFailed(jobId: string, message: string) {
  const job = await prisma.videoJob.update({
    where: { id: jobId },
    data: {
      status: 'failed',
      completedAt: new Date(),
      errorMessage: message,
      retryCount: {
        increment: 1,
      },
    },
    select: {
      id: true,
      projectId: true,
      variantIndex: true,
      status: true,
      errorMessage: true,
      completedAt: true,
    },
  });

  await updateProjectTerminalStatus(job.projectId);
  return job;
}

export async function processClaimedVideoJob(job: NonNullable<ClaimedVideoJob>) {
  try {
    const hasSourceMedia = job.project.selectedAssetIds.length > 0 || !!job.project.hookAssetId;
    if (!hasSourceMedia) {
      throw new Error('Project has no source media selected');
    }
    if (!job.script.hookText.trim() || !job.script.bodyText.trim() || !job.script.ctaText.trim()) {
      throw new Error('Script is incomplete');
    }

    return markVideoJobDone(job.id);
  } catch (error: any) {
    return markVideoJobFailed(job.id, error?.message || 'Worker failed to process job');
  }
}

export async function processNextPendingVideoJob(projectId?: string) {
  const claimed = await claimNextPendingVideoJob(projectId);
  if (!claimed) return null;
  return processClaimedVideoJob(claimed);
}

export async function processAllPendingVideoJobsForProject(projectId: string) {
  const processed: Array<Awaited<ReturnType<typeof processNextPendingVideoJob>>> = [];

  while (true) {
    const result = await processNextPendingVideoJob(projectId);
    if (!result) break;
    processed.push(result);
  }

  return processed.filter(Boolean);
}
