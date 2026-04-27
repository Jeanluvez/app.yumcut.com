import path from 'node:path';
import { prisma } from '@/server/db';
import { uploadFileToSupabaseStorage, uploadLocalFileToSupabaseStorage } from '@/server/supabase-storage';
import { synthesizeSpeech } from '@/server/tts';

type ClaimedVideoJob = Awaited<ReturnType<typeof claimNextPendingVideoJob>>;

const DEMO_VIDEO_FILE_PATH = path.resolve(process.cwd(), 'scripts/daemon/assets/video/final-demo.mp4');

async function createVoiceoverArtifacts(job: {
  id: string;
  projectId: string;
  project: { userId: string };
  script: { hookText: string; bodyText: string; ctaText: string };
}, language: 'en' | 'es') {
  const text = [job.script.hookText, job.script.bodyText, job.script.ctaText]
    .map((part) => part.trim())
    .filter(Boolean)
    .join('\n\n');

  const synthesized = await synthesizeSpeech({
    text,
    userId: job.project.userId,
    language,
  });

  const audioStoragePath = `users/${job.project.userId}/projects/${job.projectId}/voiceovers/${job.id}.mp3`;
  const uploadedAudio = await uploadFileToSupabaseStorage({
    path: audioStoragePath,
    contentType: synthesized.contentType,
    body: synthesized.audioBuffer.buffer.slice(
      synthesized.audioBuffer.byteOffset,
      synthesized.audioBuffer.byteOffset + synthesized.audioBuffer.byteLength,
    ),
    upsert: true,
  });

  let timestampsUrl: string | null = null;
  if (synthesized.timestamps) {
    const timestampsStoragePath = `users/${job.project.userId}/projects/${job.projectId}/voiceovers/${job.id}-timestamps.json`;
    const timestampsBuffer = Buffer.from(JSON.stringify(synthesized.timestamps, null, 2));
    const uploadedTimestamps = await uploadFileToSupabaseStorage({
      path: timestampsStoragePath,
      contentType: 'application/json',
      body: timestampsBuffer.buffer.slice(
        timestampsBuffer.byteOffset,
        timestampsBuffer.byteOffset + timestampsBuffer.byteLength,
      ),
      upsert: true,
    });
    timestampsUrl = uploadedTimestamps.publicUrl;
  }

  return {
    voiceoverUrl: uploadedAudio.publicUrl,
    ttsTimestampsUrl: timestampsUrl,
    audioDurationMs: synthesized.durationMs,
  };
}

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
  const now = new Date();
  const job = await prisma.videoJob.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      projectId: true,
      scriptId: true,
      variantIndex: true,
      project: {
        select: {
          userId: true,
          durationSeconds: true,
          language: true,
        },
      },
      script: {
        select: {
          styleLabel: true,
          hookText: true,
          bodyText: true,
          ctaText: true,
        },
      },
    },
  });
  if (!job) {
    throw new Error('Video job not found');
  }

  const voiceoverArtifacts = await createVoiceoverArtifacts(job, job.project.language);
  const storagePath = `users/${job.project.userId}/projects/${job.projectId}/outputs/${jobId}-final.mp4`;
  const uploadedVideo = await uploadLocalFileToSupabaseStorage({
    path: storagePath,
    localFilePath: DEMO_VIDEO_FILE_PATH,
    contentType: 'video/mp4',
    upsert: true,
  });
  const finalUrl = uploadedVideo.publicUrl;
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const updated = await prisma.$transaction(async (tx) => {
    const nextJob = await tx.videoJob.update({
      where: { id: jobId },
      data: {
        status: 'done',
        completedAt: now,
        errorMessage: null,
        voiceoverUrl: voiceoverArtifacts.voiceoverUrl,
        ttsTimestampsUrl: voiceoverArtifacts.ttsTimestampsUrl,
        finalUrl,
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

    await tx.video.upsert({
      where: { jobId: job.id },
      update: {
        storageUrl: finalUrl,
        durationSeconds: job.project.durationSeconds,
        fileSizeBytes: BigInt(uploadedVideo.sizeBytes),
        variantLabel: job.script.styleLabel || `Variant ${job.variantIndex}`,
        expiresAt,
      },
      create: {
        jobId: job.id,
        userId: job.project.userId,
        projectId: job.projectId,
        storageUrl: finalUrl,
        durationSeconds: job.project.durationSeconds,
        fileSizeBytes: BigInt(uploadedVideo.sizeBytes),
        variantLabel: job.script.styleLabel || `Variant ${job.variantIndex}`,
        expiresAt,
      },
    });

    return nextJob;
  });

  await updateProjectTerminalStatus(updated.projectId);
  return updated;
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
