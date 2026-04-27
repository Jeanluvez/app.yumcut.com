import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const IMAGE_SEGMENT_SECONDS = 1.5;

type RenderAsset = {
  assetUrl: string;
  assetMimeType: string;
};

type RenderInput = {
  assets: RenderAsset[];
  audioBuffer: Buffer;
  audioExtension: string;
  durationSeconds: number;
  aspectRatio: 'vertical_9_16' | 'square_1_1' | 'landscape_16_9';
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

function buildSegmentDurations(assets: RenderAsset[], totalDurationSeconds: number) {
  const imageIndexes = assets
    .map((asset, index) => (isImageMimeType(asset.assetMimeType) ? index : -1))
    .filter((index) => index >= 0);
  const videoIndexes = assets
    .map((asset, index) => (!isImageMimeType(asset.assetMimeType) ? index : -1))
    .filter((index) => index >= 0);

  if (videoIndexes.length === 0) {
    const perAsset = Math.max(1, totalDurationSeconds / assets.length);
    return assets.map(() => perAsset);
  }

  const reservedForImages = Math.min(totalDurationSeconds, imageIndexes.length * IMAGE_SEGMENT_SECONDS);
  const remainingForVideos = Math.max(videoIndexes.length, totalDurationSeconds - reservedForImages);
  const perVideo = remainingForVideos / videoIndexes.length;

  return assets.map((asset) => (isImageMimeType(asset.assetMimeType) ? IMAGE_SEGMENT_SECONDS : perVideo));
}

export async function renderBasicVideoFromAssets(input: RenderInput) {
  if (input.assets.length === 0) {
    throw new Error('At least one asset is required to render video');
  }

  const workspace = await mkdtemp(path.join(os.tmpdir(), 'sprokl-render-'));
  try {
    await mkdir(workspace, { recursive: true });

    const audioPath = path.join(workspace, `voiceover.${input.audioExtension}`);
    const concatListPath = path.join(workspace, 'concat.txt');
    const mergedVideoPath = path.join(workspace, 'merged.mp4');
    const outputPath = path.join(workspace, 'final.mp4');
    await writeFile(audioPath, input.audioBuffer);

    const { width, height } = getAspectSize(input.aspectRatio);
    const segmentDurations = buildSegmentDurations(input.assets, input.durationSeconds);

    const segmentPaths: string[] = [];
    for (let i = 0; i < input.assets.length; i += 1) {
      const segmentPath = await prepareSegment(workspace, input.assets[i], i, segmentDurations[i], width, height);
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

    await execFileAsync(
      '/opt/homebrew/bin/ffmpeg',
      [
        '-y',
        '-i', mergedVideoPath,
        '-i', audioPath,
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
