import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const HOOK_SEGMENT_SECONDS = 1.8;
const IMAGE_SEGMENT_SECONDS = 2.5;
const VIDEO_SEGMENT_SECONDS = 3;

type RenderAsset = {
  assetUrl: string;
  assetMimeType: string;
  role?: 'hook' | 'main';
};

type RenderInput = {
  assets: RenderAsset[];
  audioBuffer: Buffer;
  audioExtension: string;
  backgroundMusicPath?: string | null;
  backgroundMusicVolume?: number;
  durationSeconds: number;
  aspectRatio: 'vertical_9_16' | 'square_1_1' | 'landscape_16_9';
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

  const videoFilter = `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height}`;
  const ffmpegArgs = isImageMimeType(asset.assetMimeType)
    ? [
        '-y',
        '-loop', '1',
        '-i', sourcePath,
        '-t', String(clipDurationSeconds),
        '-vf', videoFilter,
        '-an',
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        segmentPath,
      ]
    : [
        '-y',
        '-stream_loop', '-1',
        '-i', sourcePath,
        '-t', String(clipDurationSeconds),
        '-vf', videoFilter,
        '-an',
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        segmentPath,
      ];

  await execFileAsync('/opt/homebrew/bin/ffmpeg', ffmpegArgs, { maxBuffer: 20 * 1024 * 1024 });
  return segmentPath;
}

function buildSegmentPlan(assets: RenderAsset[], totalDurationSeconds: number) {
  const basePlan = assets.map((asset) => ({
    asset,
    durationSeconds:
      asset.role === 'hook'
        ? HOOK_SEGMENT_SECONDS
        : isImageMimeType(asset.assetMimeType)
          ? IMAGE_SEGMENT_SECONDS
          : VIDEO_SEGMENT_SECONDS,
  }));

  const baseTotal = basePlan.reduce((sum, item) => sum + item.durationSeconds, 0);
  if (baseTotal >= totalDurationSeconds) {
    const scale = totalDurationSeconds / baseTotal;
    return basePlan.map((item) => ({
      asset: item.asset,
      durationSeconds: Math.max(0.8, item.durationSeconds * scale),
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
    const delta = Math.min(VIDEO_SEGMENT_SECONDS, remaining);
    basePlan[index].durationSeconds += delta;
    remaining -= delta;
    cursor += 1;
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
Style: Default,Arial,40,&H00FFFFFF,&H000000FF,&H00111111,&H55000000,1,0,0,0,100,100,0,0,1,2,0,2,48,48,145,1

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
    const segmentPlan = buildSegmentPlan(input.assets, input.durationSeconds);

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
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        mergedVideoPath,
      ],
      { maxBuffer: 20 * 1024 * 1024 },
    );

    const videoInputPath = input.subtitleEntries && input.subtitleEntries.length > 0
      ? await (async () => {
          const subtitlePath = await writeSubtitleFile(workspace, input.subtitleEntries);
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
