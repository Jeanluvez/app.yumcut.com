import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const DEFAULT_HOOK_SEGMENT_SECONDS = 1.8;
const DEFAULT_IMAGE_SEGMENT_SECONDS = 2.5;
const DEFAULT_VIDEO_SEGMENT_SECONDS = 3;
const DEFAULT_SUBTITLE_FONT_SIZE = 40;

type RenderAsset = {
  assetUrl: string;
  assetMimeType: string;
  role?: 'hook' | 'main';
  sourceStartSeconds?: number;
  sourceDurationSeconds?: number;
  sourceClipMaxSeconds?: number;
};

type RenderInput = {
  assets: RenderAsset[];
  audioBuffer: Buffer;
  audioExtension: string;
  backgroundMusicPath?: string | null;
  backgroundMusicVolume?: number;
  watermarkText?: string | null;
  durationSeconds: number;
  aspectRatio: 'vertical_9_16' | 'square_1_1' | 'landscape_16_9';
  hookSegmentSeconds?: number;
  imageSegmentSeconds?: number;
  videoSegmentSeconds?: number;
  subtitleFontSize?: number;
  subtitleEntries?: Array<{
    startSeconds: number;
    endSeconds: number;
    text: string;
  }>;
};

function getAspectSize(aspectRatio: RenderInput['aspectRatio']) {
  if (aspectRatio === 'square_1_1') return { width: 1080, height: 1080 };
  if (aspectRatio === 'landscape_16_9') return { width: 1280, height: 720 };
  return { width: 720, height: 1280 };
}

function getOutputExtensionFromMime(mimeType: string) {
  if (mimeType.includes('png')) return '.png';
  if (mimeType.includes('webp')) return '.webp';
  if (mimeType.includes('jpeg') || mimeType.includes('jpg')) return '.jpg';
  if (mimeType.includes('quicktime')) return '.mov';
  if (mimeType.includes('webm')) return '.webm';
  return '.mp4';
}

function isImageMimeType(mimeType: string) {
  return mimeType.startsWith('image/');
}

async function downloadRemoteFile(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download source asset (${response.status})`);
  }
  return Buffer.from(await response.arrayBuffer());
}

async function prepareSegment(
  workspace: string,
  asset: RenderAsset,
  index: number,
  clipDurationSeconds: number,
  width: number,
  height: number,
) {
  const sourceBuffer = await downloadRemoteFile(asset.assetUrl);
  const sourcePath = path.join(workspace, `source-${index}${getOutputExtensionFromMime(asset.assetMimeType)}`);
  const segmentPath = path.join(workspace, `segment-${index}.mp4`);
  await writeFile(sourcePath, sourceBuffer);

  const imageFrameRate = 30;
  const totalFrames = Math.max(1, Math.round(clipDurationSeconds * imageFrameRate));
  const zoomStart = index % 2 === 0 ? 1.02 : 1.05;
  const zoomLimit = index % 2 === 0 ? 1.12 : 1.15;
  const zoomPanFilter = [
    `scale=${Math.max(width, 1280)}:${Math.max(height, 1280)}:force_original_aspect_ratio=increase`,
    `zoompan=z='if(eq(on,1),${zoomStart.toFixed(3)},min(${zoomLimit.toFixed(3)},pzoom+0.0012))'`,
    `:x='(iw-iw/zoom)/2'`,
    `:y='(ih-ih/zoom)/2'`,
    `:d=${totalFrames}:s=${width}x${height}:fps=${imageFrameRate}`,
  ].join('');
  const videoFilter = `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height}`;
  const safeDurationSeconds =
    !isImageMimeType(asset.assetMimeType) &&
    (
      typeof asset.sourceStartSeconds === 'number' ||
      typeof asset.sourceClipMaxSeconds === 'number'
    )
      ? Math.max(
          0.8,
          Math.min(
            clipDurationSeconds,
            typeof asset.sourceDurationSeconds === 'number' && typeof asset.sourceStartSeconds === 'number'
              ? asset.sourceDurationSeconds - asset.sourceStartSeconds - 0.12
              : clipDurationSeconds,
            typeof asset.sourceClipMaxSeconds === 'number'
              ? Math.max(0.8, asset.sourceClipMaxSeconds - 0.06)
              : clipDurationSeconds,
          ),
        )
      : clipDurationSeconds;
  const ffmpegArgs = isImageMimeType(asset.assetMimeType)
    ? [
        '-y',
        '-loop', '1',
        '-i', sourcePath,
        '-t', String(safeDurationSeconds),
        '-vf', zoomPanFilter,
        '-an',
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-r', String(imageFrameRate),
        segmentPath,
      ]
    : [
        '-y',
        '-i', sourcePath,
        ...(typeof asset.sourceStartSeconds === 'number' ? ['-ss', String(asset.sourceStartSeconds)] : []),
        '-t', String(safeDurationSeconds),
        '-vf', videoFilter,
        '-an',
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        segmentPath,
      ];

  try {
    await execFileAsync('/opt/homebrew/bin/ffmpeg', ffmpegArgs, { maxBuffer: 20 * 1024 * 1024 });
  } catch (error) {
    if (!isImageMimeType(asset.assetMimeType)) {
      throw error;
    }

    // Fallback: never block the whole job because a Ken Burns image motion filter failed.
    await execFileAsync(
      '/opt/homebrew/bin/ffmpeg',
      [
        '-y',
        '-loop', '1',
        '-i', sourcePath,
        '-t', String(safeDurationSeconds),
        '-vf', videoFilter,
        '-an',
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        segmentPath,
      ],
      { maxBuffer: 20 * 1024 * 1024 },
    );
  }
  return segmentPath;
}

async function probeMediaDurationSeconds(filePath: string) {
  const { stdout } = await execFileAsync(
    '/opt/homebrew/bin/ffprobe',
    [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      filePath,
    ],
    { maxBuffer: 4 * 1024 * 1024 },
  );

  const duration = Number.parseFloat(stdout.trim());
  if (!Number.isFinite(duration) || duration <= 0) {
    return null;
  }
  return duration;
}

function shuffleArray<T>(items: T[]) {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

async function expandVideoAssetsIntoSlices(
  workspace: string,
  assets: RenderAsset[],
  timing: {
    imageSegmentSeconds: number;
    videoSegmentSeconds: number;
  },
  totalDurationSeconds: number,
) {
  const prepared = await Promise.all(
    assets.map(async (asset, index) => {
      const sourceBuffer = await downloadRemoteFile(asset.assetUrl);
      const sourcePath = path.join(workspace, `asset-${index}${getOutputExtensionFromMime(asset.assetMimeType)}`);
      await writeFile(sourcePath, sourceBuffer);

      return {
        asset,
        sourcePath,
        durationSeconds: isImageMimeType(asset.assetMimeType)
          ? null
          : await probeMediaDurationSeconds(sourcePath),
      };
    }),
  );

  const hookAssets = prepared
    .filter((item) => item.asset.role === 'hook')
    .map((item) => ({
      ...item.asset,
      sourceDurationSeconds: item.durationSeconds ?? undefined,
      sourceStartSeconds: 0,
      sourceClipMaxSeconds: item.durationSeconds
        ? Math.min(item.durationSeconds, DEFAULT_HOOK_SEGMENT_SECONDS)
        : DEFAULT_HOOK_SEGMENT_SECONDS,
    }));
  const imageAssets = prepared
    .filter((item) => item.asset.role !== 'hook' && isImageMimeType(item.asset.assetMimeType))
    .map((item) => item.asset);
  const hasImages = imageAssets.length > 0;
  const maxVideoSlicesPerSource = hasImages ? 2 : 4;
  const reservedSecondsForImages = imageAssets.length * timing.imageSegmentSeconds;
  const reservedSecondsForHooks = hookAssets.length * DEFAULT_HOOK_SEGMENT_SECONDS;
  const availableSecondsForVideos = Math.max(
    timing.videoSegmentSeconds,
    totalDurationSeconds - reservedSecondsForImages - reservedSecondsForHooks,
  );

  const videoSlices = prepared.flatMap((item) => {
    if (item.asset.role === 'hook' || isImageMimeType(item.asset.assetMimeType)) {
      return [];
    }

    const durationSeconds = item.durationSeconds ?? timing.videoSegmentSeconds;
    if (durationSeconds <= timing.videoSegmentSeconds * 1.35) {
      return [{
        ...item.asset,
        sourceDurationSeconds: durationSeconds,
        sourceStartSeconds: 0,
        sourceClipMaxSeconds: Math.min(durationSeconds, timing.videoSegmentSeconds),
      }];
    }

    const naturalSliceCount = Math.min(
      maxVideoSlicesPerSource,
      Math.max(2, Math.floor(durationSeconds / Math.max(1.2, timing.videoSegmentSeconds))),
    );
    const sliceCount = Math.max(
      1,
      Math.min(
        naturalSliceCount,
        Math.max(1, Math.floor(availableSecondsForVideos / Math.max(1.2, timing.videoSegmentSeconds))),
      ),
    );
    const sliceDuration = Math.min(
      timing.videoSegmentSeconds,
      Math.max(1.2, durationSeconds / Math.max(1, sliceCount)),
    );
    const maxStart = Math.max(0, durationSeconds - sliceDuration);

    return Array.from({ length: sliceCount }, (_, sliceIndex) => ({
      ...item.asset,
      sourceDurationSeconds: durationSeconds,
      sourceStartSeconds: sliceCount === 1 ? 0 : (maxStart * sliceIndex) / (sliceCount - 1),
      sourceClipMaxSeconds: sliceDuration,
    }));
  });

  const randomizedVideoSlices = shuffleArray(videoSlices);
  const randomizedMainAssets = hasImages
    ? (() => {
        const mixed: RenderAsset[] = [];
        const queue = [...randomizedVideoSlices];
        imageAssets.forEach((imageAsset, imageIndex) => {
          const nextVideo = queue.shift();
          if (nextVideo) mixed.push(nextVideo);
          mixed.push(imageAsset);
          if (imageIndex === imageAssets.length - 1 && queue.length > 0) {
            mixed.push(...queue);
          }
        });
        return mixed;
      })()
    : randomizedVideoSlices;
  return [...hookAssets, ...randomizedMainAssets];
}

function buildSegmentPlan(
  assets: RenderAsset[],
  totalDurationSeconds: number,
  timing: {
    hookSegmentSeconds: number;
    imageSegmentSeconds: number;
    videoSegmentSeconds: number;
  },
) {
  const getPreferredDuration = (asset: RenderAsset) => (
    asset.role === 'hook'
      ? timing.hookSegmentSeconds
      : isImageMimeType(asset.assetMimeType)
        ? timing.imageSegmentSeconds
        : timing.videoSegmentSeconds
  );

  const getMaxRenderableDuration = (asset: RenderAsset) => (
    typeof asset.sourceClipMaxSeconds === 'number'
      ? Math.max(0.8, asset.sourceClipMaxSeconds - 0.06)
      : getPreferredDuration(asset)
  );

  const capDuration = (asset: RenderAsset, desiredSeconds: number) =>
    Math.max(0.8, Math.min(desiredSeconds, getMaxRenderableDuration(asset)));

  const basePlan = assets.map((asset) => ({
    asset,
    durationSeconds: capDuration(asset, getPreferredDuration(asset)),
  }));

  const baseTotal = basePlan.reduce((sum, item) => sum + item.durationSeconds, 0);
  if (baseTotal >= totalDurationSeconds) {
    const scale = totalDurationSeconds / baseTotal;
    return basePlan.map((item) => ({
      asset: item.asset,
      durationSeconds: capDuration(item.asset, item.durationSeconds * scale),
    }));
  }

  let remaining = totalDurationSeconds - baseTotal;
  const targetIndexes = basePlan
    .map((item, index) => (
      item.asset.role === 'hook'
        ? -1
        : !isImageMimeType(item.asset.assetMimeType)
          ? index
          : -1
    ))
    .filter((index) => index >= 0);
  const extendIndexes = targetIndexes.length > 0 ? targetIndexes : basePlan.map((_, index) => index);

  let cursor = 0;
  while (remaining > 0.05) {
    const index = extendIndexes[cursor % extendIndexes.length];
    const current = basePlan[index];
    const maxAllowed = getMaxRenderableDuration(current.asset);
    const capacity = Math.max(0, maxAllowed - current.durationSeconds);
    const delta = Math.min(timing.videoSegmentSeconds, remaining, capacity);
    if (delta > 0.01) {
      current.durationSeconds += delta;
      remaining -= delta;
    }
    cursor += 1;
    if (cursor > extendIndexes.length * 3) break;
  }

  if (remaining > 0.05) {
    const repeatableAssets = assets.filter((asset) => asset.role !== 'hook');
    let repeatCursor = 0;
    while (remaining > 0.05 && repeatableAssets.length > 0) {
      const asset = repeatableAssets[repeatCursor % repeatableAssets.length];
      const durationSeconds = capDuration(asset, Math.min(getPreferredDuration(asset), remaining));
      basePlan.push({
        asset,
        durationSeconds,
      });
      remaining -= durationSeconds;
      repeatCursor += 1;
      if (repeatCursor > repeatableAssets.length * 12) break;
    }
  }

  return basePlan;
}

function escapeAssText(value: string) {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/\n/g, '\\N');
}

function wrapSubtitleText(value: string, maxCharsPerLine = 18, maxLines = 2) {
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';

  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    if (candidate.length <= maxCharsPerLine || currentLine.length === 0) {
      currentLine = candidate;
      continue;
    }

    lines.push(currentLine);
    currentLine = word;

    if (lines.length === maxLines - 1) {
      break;
    }
  }

  const consumedWordCount = lines.join(' ').split(/\s+/).filter(Boolean).length;
  const remainingWords = words.slice(consumedWordCount);

  if (lines.length < maxLines && currentLine) {
    const tail = [currentLine, ...remainingWords].join(' ').trim();
    lines.push(tail);
  } else if (remainingWords.length > 0 && lines.length > 0) {
    lines[lines.length - 1] = `${lines[lines.length - 1]} ${remainingWords.join(' ')}`.trim();
  }

  return lines.slice(0, maxLines).join('\n');
}

function formatAssTime(seconds: number) {
  const safe = Math.max(0, seconds);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = Math.floor(safe % 60);
  const centiseconds = Math.floor((safe - Math.floor(safe)) * 100);
  return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}`;
}

async function writeSubtitleFile(
  workspace: string,
  entries: NonNullable<RenderInput['subtitleEntries']>,
  fontSize: number,
) {
  const subtitlePath = path.join(workspace, 'subtitles.ass');
  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: 720
PlayResY: 1280
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,${fontSize},&H00FFFFFF,&H000000FF,&H00111111,&H55000000,1,0,0,0,100,100,0,0,1,2,0,2,48,48,145,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const body = entries
    .filter((entry) => entry.text.trim().length > 0 && entry.endSeconds > entry.startSeconds)
    .map(
      (entry) =>
        `Dialogue: 0,${formatAssTime(entry.startSeconds)},${formatAssTime(entry.endSeconds)},Default,,0,0,0,,${escapeAssText(wrapSubtitleText(entry.text.trim()))}`,
    )
    .join('\n');

  await writeFile(subtitlePath, `${header}${body}\n`);
  return subtitlePath;
}

export async function renderBasicVideoFromAssets(input: RenderInput) {
  if (input.assets.length === 0) {
    throw new Error('At least one asset is required to render video');
  }

  const workspace = await mkdtemp(path.join(os.tmpdir(), 'sprokl-render-'));
  try {
    await mkdir(workspace, { recursive: true });

    const audioPath = path.join(workspace, `voiceover.${input.audioExtension}`);
    const mixedAudioPath = path.join(workspace, 'mixed-audio.m4a');
    const concatListPath = path.join(workspace, 'concat.txt');
    const mergedVideoPath = path.join(workspace, 'merged.mp4');
    const subtitledVideoPath = path.join(workspace, 'subtitled.mp4');
    const outputPath = path.join(workspace, 'final.mp4');
    await writeFile(audioPath, input.audioBuffer);

    const { width, height } = getAspectSize(input.aspectRatio);
    const expandedAssets = await expandVideoAssetsIntoSlices(workspace, input.assets, {
      imageSegmentSeconds: input.imageSegmentSeconds ?? DEFAULT_IMAGE_SEGMENT_SECONDS,
      videoSegmentSeconds: input.videoSegmentSeconds ?? DEFAULT_VIDEO_SEGMENT_SECONDS,
    }, input.durationSeconds);
    const segmentPlan = buildSegmentPlan(expandedAssets, input.durationSeconds, {
      hookSegmentSeconds: input.hookSegmentSeconds ?? DEFAULT_HOOK_SEGMENT_SECONDS,
      imageSegmentSeconds: input.imageSegmentSeconds ?? DEFAULT_IMAGE_SEGMENT_SECONDS,
      videoSegmentSeconds: input.videoSegmentSeconds ?? DEFAULT_VIDEO_SEGMENT_SECONDS,
    });

    const segmentPaths: string[] = [];
    for (let i = 0; i < segmentPlan.length; i += 1) {
      const segmentPath = await prepareSegment(
        workspace,
        segmentPlan[i].asset,
        i,
        segmentPlan[i].durationSeconds,
        width,
        height,
      );
      segmentPaths.push(segmentPath);
    }

    await writeFile(
      concatListPath,
      segmentPaths.map((segmentPath) => `file '${segmentPath.replace(/'/g, "'\\''")}'`).join('\n'),
    );

    await execFileAsync(
      '/opt/homebrew/bin/ffmpeg',
      [
        '-y',
        '-f', 'concat',
        '-safe', '0',
        '-i', concatListPath,
        ...(input.watermarkText
          ? [
              '-vf',
              `drawtext=text='${input.watermarkText.replace(/'/g, "\\'").replace(/:/g, '\\:')}':fontcolor=white@0.82:fontsize=28:box=1:boxcolor=black@0.35:boxborderw=14:x=w-tw-32:y=h-th-32`,
            ]
          : []),
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        mergedVideoPath,
      ],
      { maxBuffer: 20 * 1024 * 1024 },
    );

    const videoInputPath = input.subtitleEntries && input.subtitleEntries.length > 0
      ? await (async () => {
          const subtitlePath = await writeSubtitleFile(
            workspace,
            input.subtitleEntries,
            input.subtitleFontSize ?? DEFAULT_SUBTITLE_FONT_SIZE,
          );
          await execFileAsync(
            '/opt/homebrew/bin/ffmpeg',
            [
              '-y',
              '-i', mergedVideoPath,
              '-vf', `subtitles=${subtitlePath.replace(/:/g, '\\:')}`,
              '-c:v', 'libx264',
              '-pix_fmt', 'yuv420p',
              subtitledVideoPath,
            ],
            { maxBuffer: 20 * 1024 * 1024 },
          );
          return subtitledVideoPath;
        })()
      : mergedVideoPath;

    const finalAudioPath = input.backgroundMusicPath
      ? await (async () => {
          await execFileAsync(
            '/opt/homebrew/bin/ffmpeg',
            [
              '-y',
              '-i', audioPath,
              '-stream_loop', '-1',
              '-i', input.backgroundMusicPath,
              '-filter_complex',
              `[1:a]volume=${String(input.backgroundMusicVolume ?? 0.12)}[bgm];[0:a][bgm]amix=inputs=2:duration=first:dropout_transition=2[aout]`,
              '-map', '[aout]',
              '-t', String(input.durationSeconds),
              '-c:a', 'aac',
              mixedAudioPath,
            ],
            { maxBuffer: 20 * 1024 * 1024 },
          );
          return mixedAudioPath;
        })()
      : audioPath;

    await execFileAsync(
      '/opt/homebrew/bin/ffmpeg',
      [
        '-y',
        '-i', videoInputPath,
        '-i', finalAudioPath,
        '-t', String(input.durationSeconds),
        '-map', '0:v:0',
        '-map', '1:a:0',
        '-c:v', 'copy',
        '-af', 'apad',
        '-c:a', 'aac',
        outputPath,
      ],
      { maxBuffer: 20 * 1024 * 1024 },
    );

    const outputBuffer = await readFile(outputPath);
    return {
      outputBuffer,
      contentType: 'video/mp4',
    };
  } finally {
    await rm(workspace, { recursive: true, force: true }).catch(() => {});
  }
}
