import { prisma } from '@/server/db';
import { incrementVideoGenerationCount } from '@/server/plan-limits';
import { uploadFileToSupabaseStorage } from '@/server/supabase-storage';
import { synthesizeSpeech } from '@/server/tts';
import { renderBasicVideoFromAssets } from '@/server/video-renderer';
import path from 'node:path';

type ClaimedVideoJob = Awaited<ReturnType<typeof claimNextPendingVideoJob>>;
type SubtitleEntry = {
  startSeconds: number;
  endSeconds: number;
  text: string;
};

const DEFAULT_BACKGROUND_MUSIC_PATH = path.join(process.cwd(), 'content/music/my-1-back.wav');
const DEFAULT_BACKGROUND_MUSIC_URL = 'bundled://content/music/my-1-back.wav';

function normalizeRenderOptions(promoInfo: unknown) {
  const renderOptions =
    promoInfo && typeof promoInfo === 'object' && 'renderOptions' in promoInfo
      ? (promoInfo as { renderOptions?: { captionsEnabled?: boolean; backgroundMusicEnabled?: boolean } }).renderOptions
      : null;

  return {
    captionsEnabled: renderOptions?.captionsEnabled !== false,
    backgroundMusicEnabled: renderOptions?.backgroundMusicEnabled !== false,
  };
}

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
    audioBuffer: synthesized.audioBuffer,
    audioExtension: synthesized.contentType === 'audio/mpeg' ? 'mp3' : 'wav',
    timestamps: synthesized.timestamps,
  };
}

function buildSubtitleEntriesFromTimestamps(timestamps: unknown): SubtitleEntry[] {
  if (!timestamps || typeof timestamps !== 'object') return [];

  const raw = timestamps as {
    characters?: string[];
    character_start_times_seconds?: number[];
    character_end_times_seconds?: number[];
  };

  if (
    !Array.isArray(raw.characters) ||
    !Array.isArray(raw.character_start_times_seconds) ||
    !Array.isArray(raw.character_end_times_seconds)
  ) {
    return [];
  }

  const joinedText = raw.characters.join('');
  const words = joinedText
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (words.length === 0) return [];

  const entries: SubtitleEntry[] = [];
  let charCursor = 0;
  let wordBuffer: string[] = [];
  let startSeconds: number | null = null;
  let endSeconds = 0;

  for (const word of words) {
    const startIndex = joinedText.indexOf(word, charCursor);
    if (startIndex < 0) continue;
    const endIndex = startIndex + word.length - 1;
    charCursor = endIndex + 1;

    const wordStart = raw.character_start_times_seconds[startIndex];
    const wordEnd = raw.character_end_times_seconds[endIndex];
    if (typeof wordStart !== 'number' || typeof wordEnd !== 'number') continue;

    if (startSeconds === null) startSeconds = wordStart;
    endSeconds = wordEnd;
    wordBuffer.push(word);

    if (wordBuffer.length >= 5) {
      entries.push({
        startSeconds,
        endSeconds,
        text: wordBuffer.join(' '),
      });
      wordBuffer = [];
      startSeconds = null;
    }
  }

  if (wordBuffer.length > 0 && startSeconds !== null) {
    entries.push({
      startSeconds,
      endSeconds,
      text: wordBuffer.join(' '),
    });
  }

  return entries;
}

async function resolveRenderAssets(job: {
  project: { selectedAssetIds: string[]; hookAssetId: string | null; userId: string };
  projectId: string;
}) {
  const selectedIds = job.project.selectedAssetIds;
  const candidateIds = Array.from(
    new Set([
      ...(job.project.hookAssetId ? [job.project.hookAssetId] : []),
      ...selectedIds,
    ]),
  );

  if (candidateIds.length === 0) {
    throw new Error('Project has no source media selected');
  }

  const assets = await prisma.asset.findMany({
    where: {
      id: { in: candidateIds },
      projectId: job.projectId,
      userId: job.project.userId,
    },
    select: {
      id: true,
      storageUrl: true,
      mimeType: true,
      type: true,
    },
  });

  if (assets.length === 0) {
    throw new Error('Selected source asset could not be loaded');
  }

  const assetById = new Map(assets.map((asset) => [asset.id, asset] as const));
  const orderedSelectedAssets = selectedIds
    .map((id) => assetById.get(id))
    .filter((asset): asset is NonNullable<typeof asset> => !!asset);

  const mainAssets = orderedSelectedAssets.filter((asset) => asset.type === 'video' || asset.type === 'image');
  const hookAsset = job.project.hookAssetId ? assetById.get(job.project.hookAssetId) ?? null : null;

  if (hookAsset && hookAsset.type === 'hook') {
    return [
      {
        ...hookAsset,
        role: 'hook' as const,
      },
      ...mainAssets.map((asset) => ({
        ...asset,
        role: 'main' as const,
      })),
    ];
  }

  if (mainAssets.length > 0) {
    return mainAssets.map((asset) => ({
      ...asset,
      role: 'main' as const,
    }));
  }

  if (hookAsset) {
    return [
      {
        ...hookAsset,
        role: 'hook' as const,
      },
    ];
  }

  throw new Error('Selected source asset could not be resolved');
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
          aspectRatio: true,
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
          aspectRatio: true,
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
          user: {
            select: {
              plan: true,
            },
          },
          durationSeconds: true,
          language: true,
          aspectRatio: true,
          selectedAssetIds: true,
          hookAssetId: true,
          promoInfo: true,
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
  const renderAssets = await resolveRenderAssets(job);
  const renderOptions = normalizeRenderOptions(job.project.promoInfo);
  const renderedVideo = await renderBasicVideoFromAssets({
    assets: renderAssets.map((asset) => ({
      assetUrl: asset.storageUrl,
      assetMimeType: asset.mimeType,
      role: asset.role,
    })),
    audioBuffer: voiceoverArtifacts.audioBuffer,
    audioExtension: voiceoverArtifacts.audioExtension,
    backgroundMusicPath: renderOptions.backgroundMusicEnabled ? DEFAULT_BACKGROUND_MUSIC_PATH : null,
    backgroundMusicVolume: renderOptions.backgroundMusicEnabled ? 0.1872 : undefined,
    watermarkText: job.project.user.plan === 'free' ? 'Sprokl' : null,
    durationSeconds: job.project.durationSeconds,
    aspectRatio: job.project.aspectRatio,
    subtitleEntries: renderOptions.captionsEnabled
      ? buildSubtitleEntriesFromTimestamps(voiceoverArtifacts.timestamps)
      : [],
  });
  const storagePath = `users/${job.project.userId}/projects/${job.projectId}/outputs/${jobId}-final.mp4`;
  const uploadedVideo = await uploadFileToSupabaseStorage({
    path: storagePath,
    contentType: renderedVideo.contentType,
    body: renderedVideo.outputBuffer.buffer.slice(
      renderedVideo.outputBuffer.byteOffset,
      renderedVideo.outputBuffer.byteOffset + renderedVideo.outputBuffer.byteLength,
    ),
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
        musicUrl: renderOptions.backgroundMusicEnabled ? DEFAULT_BACKGROUND_MUSIC_URL : null,
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
        fileSizeBytes: BigInt(renderedVideo.outputBuffer.byteLength),
        variantLabel: job.script.styleLabel || `Variant ${job.variantIndex}`,
        expiresAt,
      },
      create: {
        jobId: job.id,
        userId: job.project.userId,
        projectId: job.projectId,
        storageUrl: finalUrl,
        durationSeconds: job.project.durationSeconds,
        fileSizeBytes: BigInt(renderedVideo.outputBuffer.byteLength),
        variantLabel: job.script.styleLabel || `Variant ${job.variantIndex}`,
        expiresAt,
      },
    });

    return nextJob;
  });

  await incrementVideoGenerationCount(job.project.userId, 1);
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
