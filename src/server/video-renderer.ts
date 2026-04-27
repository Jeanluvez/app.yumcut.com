import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

type RenderInput = {
  assetUrl: string;
  assetMimeType: string;
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

export async function renderBasicVideoFromAsset(input: RenderInput) {
  const workspace = await mkdtemp(path.join(os.tmpdir(), 'sprokl-render-'));
  try {
    const sourceBuffer = await downloadRemoteFile(input.assetUrl);
    const sourcePath = path.join(workspace, `source${getOutputExtensionFromMime(input.assetMimeType)}`);
    const audioPath = path.join(workspace, `voiceover.${input.audioExtension}`);
    const outputPath = path.join(workspace, 'final.mp4');

    await mkdir(workspace, { recursive: true });
    await writeFile(sourcePath, sourceBuffer);
    await writeFile(audioPath, input.audioBuffer);

    const { width, height } = getAspectSize(input.aspectRatio);
    const videoFilter = `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height}`;

    const ffmpegArgs = isImageMimeType(input.assetMimeType)
      ? [
          '-y',
          '-loop', '1',
          '-i', sourcePath,
          '-i', audioPath,
          '-t', String(input.durationSeconds),
          '-map', '0:v:0',
          '-map', '1:a:0',
          '-vf', videoFilter,
          '-c:v', 'libx264',
          '-pix_fmt', 'yuv420p',
          '-c:a', 'aac',
          '-shortest',
          outputPath,
        ]
      : [
          '-y',
          '-stream_loop', '-1',
          '-i', sourcePath,
          '-i', audioPath,
          '-t', String(input.durationSeconds),
          '-map', '0:v:0',
          '-map', '1:a:0',
          '-vf', videoFilter,
          '-c:v', 'libx264',
          '-pix_fmt', 'yuv420p',
          '-c:a', 'aac',
          '-shortest',
          outputPath,
        ];

    await execFileAsync('/opt/homebrew/bin/ffmpeg', ffmpegArgs, { maxBuffer: 20 * 1024 * 1024 });
    const outputBuffer = await readFile(outputPath);

    return {
      outputBuffer,
      contentType: 'video/mp4',
    };
  } finally {
    await rm(workspace, { recursive: true, force: true }).catch(() => {});
  }
}
