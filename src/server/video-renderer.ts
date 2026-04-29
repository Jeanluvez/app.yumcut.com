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
  animateImage?: boolean;
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
  animateImages?: boolean;
  shuffleVideoSlices?: boolean;
  subtitleEntries?: Array<{
    startSeconds: number;
    endSeconds: number;
    text: string;
    words?: Array<{
      text: string;
      startSeconds: number;
      endSeconds: number;
    }>;
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
  const videoFilter = `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},fps=30`;
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
              ? Math.max(0.8, asset.sourceClipMaxSeconds - 0.16)
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
        '-vf', asset.role === 'main' && asset.animateImage === false ? videoFilter : zoomPanFilter,
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
        '-r', '30',
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
        '-r', '30',
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

async function probeKeyframeTimestamps(filePath: string) {
  const { stdout } = await execFileAsync(
    '/opt/homebrew/bin/ffprobe',
    [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-skip_frame', 'nokey',
      '-show_frames',
      '-show_entries', 'frame=best_effort_timestamp_time',
      '-of', 'json',
      filePath,
    ],
    { maxBuffer: 16 * 1024 * 1024 },
  );

  try {
    const parsed = JSON.parse(stdout) as {
      frames?: Array<{ best_effort_timestamp_time?: string }>;
    };
    return (parsed.frames ?? [])
      .map((frame) => Number.parseFloat(frame.best_effort_timestamp_time ?? ''))
      .filter((value) => Number.isFinite(value) && value >= 0);
  } catch {
    return [];
  }
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
  options: {
    animateImages: boolean;
    shuffleVideoSlices: boolean;
  },
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
        keyframeTimestamps: isImageMimeType(asset.assetMimeType)
          ? []
          : await probeKeyframeTimestamps(sourcePath),
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
    .map((item) => ({
      ...item.asset,
      animateImage: options.animateImages,
    }));
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

    if (!options.shuffleVideoSlices) {
      return [{
        ...item.asset,
        sourceDurationSeconds: durationSeconds,
        sourceStartSeconds: 0,
        sourceClipMaxSeconds: Math.min(durationSeconds, timing.videoSegmentSeconds),
      }];
    }

    const maxSliceCount = Math.max(
      1,
      Math.min(
        maxVideoSlicesPerSource,
        Math.max(1, Math.floor(availableSecondsForVideos / Math.max(1.2, timing.videoSegmentSeconds))),
      ),
    );

    if (options.shuffleVideoSlices) {
      const minSegmentSeconds = Math.max(1.2, timing.videoSegmentSeconds * 0.55);
      const targetSegmentSeconds = timing.videoSegmentSeconds;
      const usableKeyframes = (item.keyframeTimestamps ?? []).filter(
        (time) => time > minSegmentSeconds * 0.5 && time < durationSeconds - minSegmentSeconds * 0.5,
      );
      const keyframeBoundaries = [0, ...usableKeyframes, durationSeconds];
      const keyframeSlices: RenderAsset[] = [];
      let segmentStart = 0;
      let cursor = 1;

      while (cursor < keyframeBoundaries.length && keyframeSlices.length < maxSliceCount) {
        let segmentEnd = keyframeBoundaries[cursor];
        while (cursor < keyframeBoundaries.length - 1 && segmentEnd - segmentStart < minSegmentSeconds) {
          cursor += 1;
          segmentEnd = keyframeBoundaries[cursor];
        }

        while (
          cursor < keyframeBoundaries.length - 1 &&
          keyframeBoundaries[cursor + 1] - segmentStart <= targetSegmentSeconds * 1.35
        ) {
          cursor += 1;
          segmentEnd = keyframeBoundaries[cursor];
        }

        const segmentDuration = segmentEnd - segmentStart;
        if (segmentDuration >= minSegmentSeconds) {
          keyframeSlices.push({
            ...item.asset,
            sourceDurationSeconds: durationSeconds,
            sourceStartSeconds: segmentStart,
            sourceClipMaxSeconds: segmentDuration,
          });
        }

        segmentStart = segmentEnd;
        cursor += 1;
      }

      if (keyframeSlices.length > 0) {
        return keyframeSlices;
      }
    }

    const naturalSliceCount = Math.min(
      maxVideoSlicesPerSource,
      Math.max(2, Math.floor(durationSeconds / Math.max(1.2, timing.videoSegmentSeconds))),
    );
    const sliceCount = Math.max(1, Math.min(naturalSliceCount, maxSliceCount));
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

  const randomizedVideoSlices = options.shuffleVideoSlices ? shuffleArray(videoSlices) : videoSlices;
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
      ? Math.max(0.8, asset.sourceClipMaxSeconds - 0.16)
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

function escapeDrawtextText(value: string) {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/:/g, '\\:')
    .replace(/'/g, "\\'")
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/,/g, '\\,')
    .replace(/%/g, '\\%');
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

  const consumedWordCount = lines.reduce((sum, line) => (
    sum + line.split(/\s+/).filter(Boolean).length
  ), 0);
  const currentLineWords = currentLine.split(/\s+/).filter(Boolean);
  const remainingWords = words.slice(consumedWordCount + currentLineWords.length);

  if (lines.length < maxLines && currentLine) {
    const tail = [currentLine, ...remainingWords].join(' ').trim();
    lines.push(tail);
  } else if (remainingWords.length > 0 && lines.length > 0) {
    lines[lines.length - 1] = `${lines[lines.length - 1]} ${remainingWords.join(' ')}`.trim();
  }

  return lines.slice(0, maxLines).join('\n');
}

function wrapSubtitleWords(
  words: Array<{ text: string; startSeconds: number; endSeconds: number }>,
  maxCharsPerLine = 12,
  maxLines = 2,
) {
  if (words.length === 0) return [];

  const lines: typeof words[] = [];
  let currentLine: typeof words = [];
  let currentLength = 0;

  for (const word of words) {
    const nextLength = currentLength === 0 ? word.text.length : currentLength + 1 + word.text.length;
    if (currentLine.length === 0 || nextLength <= maxCharsPerLine) {
      currentLine.push(word);
      currentLength = nextLength;
      continue;
    }

    lines.push(currentLine);
    currentLine = [word];
    currentLength = word.text.length;

    if (lines.length === maxLines - 1) {
      break;
    }
  }

  const consumedCount = lines.reduce((sum, line) => sum + line.length, 0);
  const remainingWords = words.slice(consumedCount + currentLine.length);

  if (lines.length < maxLines && currentLine.length > 0) {
    lines.push([...currentLine, ...remainingWords]);
  } else if (remainingWords.length > 0 && lines.length > 0) {
    lines[lines.length - 1].push(...remainingWords);
  }

  return lines.slice(0, maxLines);
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
Style: Default,Arial,${fontSize},&H00FFFFFF,&H00FFFFFF,&H00101010,&H55000000,1,0,0,0,100,100,0,0,1,2,0,2,48,48,145,1
Style: Highlight,Arial,${fontSize},&H00FFFFFF,&H00FFFFFF,&H00101010,&H00F020A0,1,0,0,0,100,100,0,0,3,0,0,2,48,48,145,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const dialogueLines = entries
    .filter((entry) => entry.text.trim().length > 0 && entry.endSeconds > entry.startSeconds)
    .flatMap((entry) => {
      if (!entry.words || entry.words.length === 0) {
        return [
          `Dialogue: 0,${formatAssTime(entry.startSeconds)},${formatAssTime(entry.endSeconds)},Default,,0,0,0,,${escapeAssText(wrapSubtitleText(entry.text.trim().toUpperCase(), 12, 2))}`,
        ];
      }

      const wrappedLines = wrapSubtitleWords(entry.words);
      const flattenedWords = wrappedLines.flat();
      const baseText = wrappedLines
        .map((line) => line.map((word) => escapeAssText(word.text)).join(' '))
        .join('\\N');

      const overlays = flattenedWords.map((activeWord, activeIndex) => {
        let globalIndex = 0;
        const overlayText = wrappedLines
          .map((line) => line.map((word) => {
            const isActive = globalIndex === activeIndex;
            globalIndex += 1;
            const displayText = escapeAssText(word.text);
            if (isActive) {
              return `{\\rHighlight}${displayText}{\\rDefault}`;
            }
            return `{\\1a&HFF&\\3a&HFF&\\4a&HFF&}${displayText}{\\1a&H00&\\3a&H00&\\4a&H00&}`;
          }).join(' '))
          .join('\\N');

        return `Dialogue: 1,${formatAssTime(activeWord.startSeconds)},${formatAssTime(activeWord.endSeconds)},Default,,0,0,0,,${overlayText}`;
      });

      return [
        `Dialogue: 0,${formatAssTime(entry.startSeconds)},${formatAssTime(entry.endSeconds)},Default,,0,0,0,,${baseText}`,
        ...overlays,
      ];
    });

  const body = dialogueLines.join('\n');

  await writeFile(subtitlePath, `${header}${body}\n`);
  return subtitlePath;
}

function buildDrawtextSubtitleFilter(
  entries: NonNullable<RenderInput['subtitleEntries']>,
  fontSize: number,
  width: number,
  height: number,
) {
  const fontFile = '/System/Library/Fonts/Supplemental/Arial Bold.ttf';
  const baseCharWidth = fontSize * 0.62;
  const lineHeight = Math.round(fontSize * 1.32);
  const baseY = height - 235;
  const maxLineWidth = width - 72;

  const lineY = (lineIndex: number, totalLines: number) => {
    if (totalLines === 1) return baseY;
    return baseY + lineIndex * lineHeight - Math.round((totalLines - 1) * lineHeight * 0.5);
  };

  const highlightColor = '0x93128F';
  const highlightBoxPadding = 12;
  type Segment = {
    text: string;
    highlight?: boolean;
    x: number;
    y: number;
    fontSize: number;
  };
  type SubtitleState = {
    startSeconds: number;
    endSeconds: number;
    segments: Segment[];
  };
  const states: SubtitleState[] = [];

  const getLineMetrics = (text: string) => {
    const estimatedWidth = text.length * baseCharWidth;
    const scale = estimatedWidth > maxLineWidth ? maxLineWidth / estimatedWidth : 1;
    const lineFontSize = Math.max(28, Math.floor(fontSize * scale));
    const lineCharWidth = lineFontSize * 0.62;
    const lineWidth = text.length * lineCharWidth;
    return {
      fontSize: lineFontSize,
      charWidth: lineCharWidth,
      width: lineWidth,
    };
  };

  const buildPlainDrawtext = (
    text: string,
    x: number,
    y: number,
    segmentFontSize: number,
    startSeconds: number,
    endSeconds: number,
  ) => (
    `drawtext=fontfile=${fontFile}:text='${escapeDrawtextText(text)}':` +
    `fontsize=${segmentFontSize}:fontcolor=white:borderw=4:bordercolor=black@0.96:` +
    `x=${x.toFixed(2)}:y=${y}:` +
    `enable='between(t,${startSeconds.toFixed(3)},${endSeconds.toFixed(3)})'`
  );

  const buildHighlightDrawtext = (
    text: string,
    x: number,
    y: number,
    segmentFontSize: number,
    startSeconds: number,
    endSeconds: number,
  ) => (
    `drawtext=fontfile=${fontFile}:text='${escapeDrawtextText(text)}':` +
    `fontsize=${segmentFontSize}:fontcolor=white:borderw=4:bordercolor=black@0.96:` +
    `box=1:boxcolor=${highlightColor}@1.0:boxborderw=12:` +
    `x=${x.toFixed(2)}:y=${y}:` +
    `enable='between(t,${startSeconds.toFixed(3)},${endSeconds.toFixed(3)})'`
  );

  for (const entry of entries) {
    if (entry.endSeconds <= entry.startSeconds) continue;

    if (!entry.words || entry.words.length === 0) {
      const lines = wrapSubtitleText(entry.text.trim().toUpperCase(), 12, 2)
        .split('\n')
        .filter(Boolean);
      const segments: Segment[] = lines.map((text, index) => {
        const metrics = getLineMetrics(text);
        return {
          text,
          x: (width - metrics.width) / 2,
          y: lineY(index, lines.length),
          fontSize: metrics.fontSize,
        };
      });
      states.push({
        startSeconds: entry.startSeconds,
        endSeconds: entry.endSeconds,
        segments,
      });
      continue;
    }

    const wrappedLines = wrapSubtitleWords(entry.words, 12, 2);
    const lineLayouts = wrappedLines.map((words, index) => {
      const text = words.map((word) => word.text).join(' ');
      const metrics = getLineMetrics(text);
      return {
        words,
        text,
        fontSize: metrics.fontSize,
        charWidth: metrics.charWidth,
        x: (width - metrics.width) / 2,
        y: lineY(index, wrappedLines.length),
      };
    });

    const flattenedWords = lineLayouts.flatMap((line, lineIndex) =>
      line.words.map((word, wordIndex) => ({
        word,
        lineIndex,
        wordIndex,
      })),
    );

    flattenedWords.forEach((active, activeIndex) => {
      const nextActive = flattenedWords[activeIndex + 1];
      const activeStart = Math.max(entry.startSeconds, active.word.startSeconds + 0.01);
      const provisionalEnd = Math.min(
        entry.endSeconds,
        Math.max(
          activeStart + 0.04,
          nextActive
            ? nextActive.word.startSeconds - 0.02
            : entry.endSeconds,
        ),
      );
      if (provisionalEnd <= activeStart) return;

      const segments: Segment[] = [];
      lineLayouts.forEach((line, lineIndex) => {
        if (lineIndex !== active.lineIndex) {
          segments.push({
            text: line.text,
            x: line.x,
            y: line.y,
            fontSize: line.fontSize,
          });
          return;
        }

        const prefixWords = line.words.slice(0, active.wordIndex);
        const suffixWords = line.words.slice(active.wordIndex + 1);
        const prefixText = prefixWords.map((item) => item.text).join(' ');
        const suffixText = suffixWords.map((item) => item.text).join(' ');
        const prefixWidth = prefixText.length * line.charWidth;
        const activeWidth = active.word.text.length * line.charWidth;
        const leadingSpaceWidth = prefixText ? line.charWidth : 0;
        const trailingSpaceWidth = suffixText ? line.charWidth : 0;
        const stateLineX = line.x - highlightBoxPadding;
        const prefixX = stateLineX;
        const wordX = stateLineX + prefixWidth + leadingSpaceWidth + highlightBoxPadding;

        if (prefixText) {
          segments.push({
            text: prefixText,
            x: prefixX,
            y: line.y,
            fontSize: line.fontSize,
          });
        }

        segments.push({
          text: active.word.text,
          x: wordX,
          y: line.y,
          fontSize: line.fontSize,
          highlight: true,
        });

        if (suffixText) {
          const suffixX =
            stateLineX +
            prefixWidth +
            leadingSpaceWidth +
            highlightBoxPadding * 2 +
            activeWidth +
            trailingSpaceWidth;
          segments.push({
            text: suffixText,
            x: suffixX,
            y: line.y,
            fontSize: line.fontSize,
          });
        }
      });

      states.push({
        startSeconds: activeStart,
        endSeconds: provisionalEnd,
        segments,
      });
    });
  }

  const normalizedStates = states
    .sort((a, b) => a.startSeconds - b.startSeconds)
    .map((state, index, allStates) => {
      const nextState = allStates[index + 1];
      const endSeconds = nextState
        ? Math.min(state.endSeconds, nextState.startSeconds - 0.02)
        : state.endSeconds;
      return {
        ...state,
        endSeconds,
      };
    })
    .filter((state) => state.endSeconds > state.startSeconds + 0.02);

  const filters = normalizedStates.flatMap((state) =>
    state.segments.map((segment) => (
      segment.highlight
        ? buildHighlightDrawtext(
            segment.text,
            segment.x,
            segment.y,
            segment.fontSize,
            state.startSeconds,
            state.endSeconds,
          )
        : buildPlainDrawtext(
            segment.text,
            segment.x,
            segment.y,
            segment.fontSize,
            state.startSeconds,
            state.endSeconds,
          )
    )),
  );

  return filters.join(',');
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
    }, input.durationSeconds, {
      animateImages: input.animateImages !== false,
      shuffleVideoSlices: input.shuffleVideoSlices !== false,
    });
    const segmentPlan = buildSegmentPlan(expandedAssets, input.durationSeconds, {
      hookSegmentSeconds: input.hookSegmentSeconds ?? DEFAULT_HOOK_SEGMENT_SECONDS,
      imageSegmentSeconds: input.imageSegmentSeconds ?? DEFAULT_IMAGE_SEGMENT_SECONDS,
      videoSegmentSeconds: input.videoSegmentSeconds ?? DEFAULT_VIDEO_SEGMENT_SECONDS,
    });
    const minimumBufferedVideoSeconds = input.durationSeconds + 2.5;
    const safeSegmentPlan = [...segmentPlan];
    const repeatableSegments = segmentPlan.filter((segment) => segment.asset.role !== 'hook');

    const segmentPaths: string[] = [];
    let renderedVideoSeconds = 0;
    for (let i = 0; i < safeSegmentPlan.length; i += 1) {
      const segmentPath = await prepareSegment(
        workspace,
        safeSegmentPlan[i].asset,
        i,
        safeSegmentPlan[i].durationSeconds,
        width,
        height,
      );
      segmentPaths.push(segmentPath);
      renderedVideoSeconds += (await probeMediaDurationSeconds(segmentPath)) ?? safeSegmentPlan[i].durationSeconds;
    }

    if (repeatableSegments.length > 0) {
      let repeatCursor = 0;
      while (renderedVideoSeconds < minimumBufferedVideoSeconds && repeatCursor < repeatableSegments.length * 12) {
        const template = repeatableSegments[repeatCursor % repeatableSegments.length];
        const segmentPath = await prepareSegment(
          workspace,
          template.asset,
          safeSegmentPlan.length + repeatCursor,
          template.durationSeconds,
          width,
          height,
        );
        segmentPaths.push(segmentPath);
        renderedVideoSeconds += (await probeMediaDurationSeconds(segmentPath)) ?? template.durationSeconds;
        repeatCursor += 1;
      }
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
          const subtitleFilter = buildDrawtextSubtitleFilter(
            input.subtitleEntries,
            input.subtitleFontSize ?? DEFAULT_SUBTITLE_FONT_SIZE,
            width,
            height,
          );
          await execFileAsync(
            '/opt/homebrew/bin/ffmpeg',
            [
              '-y',
              '-i', mergedVideoPath,
              '-vf', subtitleFilter,
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
              '-c:a', 'aac',
              mixedAudioPath,
            ],
            { maxBuffer: 20 * 1024 * 1024 },
          );
          return mixedAudioPath;
        })()
      : audioPath;

    const finalAudioDurationSeconds = await probeMediaDurationSeconds(finalAudioPath);
    const finalOutputDurationSeconds = Math.max(
      0.8,
      (finalAudioDurationSeconds ?? input.durationSeconds) - 0.02,
    );

    await execFileAsync(
      '/opt/homebrew/bin/ffmpeg',
      [
        '-y',
        '-i', videoInputPath,
        '-i', finalAudioPath,
        '-t', String(finalOutputDurationSeconds),
        '-map', '0:v:0',
        '-map', '1:a:0',
        '-c:v', 'copy',
        '-c:a', 'aac',
        '-shortest',
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
