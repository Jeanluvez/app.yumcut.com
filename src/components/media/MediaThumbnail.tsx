"use client";

import { useEffect, useState } from 'react';
import { Image as ImageIcon, Video } from 'lucide-react';

type MediaThumbnailProps = {
  kind: 'image' | 'video';
  src?: string | null;
  poster?: string | null;
  alt: string;
  className?: string;
  iconClassName?: string;
  videoClassName?: string;
  imageClassName?: string;
  muted?: boolean;
};

export function MediaThumbnail({
  kind,
  src,
  poster,
  alt,
  className,
  iconClassName = 'h-6 w-6 text-zinc-500',
  videoClassName,
  imageClassName,
  muted = true,
}: MediaThumbnailProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
    setVideoFailed(false);
  }, [kind, src, poster]);

  const fallback = (
    <div className={className ? `flex h-full w-full items-center justify-center ${className}` : 'flex h-full w-full items-center justify-center'}>
      {kind === 'video' ? <Video className={iconClassName} /> : <ImageIcon className={iconClassName} />}
    </div>
  );

  if (kind === 'image') {
    if (!src || imageFailed) return fallback;
    return (
      <img
        src={src}
        alt={alt}
        className={imageClassName || className || 'h-full w-full object-cover'}
        onError={() => setImageFailed(true)}
      />
    );
  }

  if (poster && !imageFailed) {
    return (
      <img
        src={poster}
        alt={alt}
        className={imageClassName || className || 'h-full w-full object-cover'}
        onError={() => setImageFailed(true)}
      />
    );
  }

  if (!src || videoFailed) return fallback;

  return (
    <video
      src={src}
      poster={poster || undefined}
      className={videoClassName || className || 'h-full w-full object-cover'}
      muted={muted}
      playsInline
      preload="metadata"
      onError={() => setVideoFailed(true)}
    />
  );
}
