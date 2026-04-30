"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Download,
  Film,
  Grid2X2,
  Image as ImageIcon,
  Languages,
  Lock,
  MoreHorizontal,
  Search,
  Sparkles,
  Upload,
  Video,
} from 'lucide-react';
import { Api } from '@/lib/api-client';
import { useProjects } from '@/components/providers/ProjectsProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

type FormState = {
  name: string;
  productName: string;
  productDescription: string;
  sellingPoints: string;
  targetAudience: string;
  durationSeconds: '30' | '60' | '90';
  language: 'en' | 'es';
  aspectRatio: 'vertical_9_16' | 'square_1_1' | 'landscape_16_9';
};

type VideoItem = {
  id: string;
  variantLabel: string | null;
  durationSeconds: number;
  fileSizeBytes: string;
  downloadCount: number;
  expiresAt: string;
  createdAt: string;
  project: {
    id: string;
    name: string;
  };
};

type AssetItem = {
  id: string;
  projectId: string | null;
  type: string;
  filename: string;
  storageUrl: string;
  thumbnailUrl: string | null;
  sizeBytes: string;
  mimeType: string;
  durationSeconds?: number | null;
  width?: number | null;
  height?: number | null;
  expiresAt: string;
  createdAt: string;
  usageCount?: number;
  project: {
    id: string;
    name: string;
  } | null;
};

type AssetSummary = {
  plan: 'free' | 'pro' | 'business';
  usedBytes: string;
  storageLimitBytes: string;
  remainingBytes: string;
  assetCount: number;
};

type ProjectItem = {
  id: string;
  title?: string | null;
  name?: string | null;
  status?: string | null;
  durationSeconds?: number | null;
  language?: 'en' | 'es' | null;
  aspectRatio?: 'vertical_9_16' | 'square_1_1' | 'landscape_16_9' | null;
  createdAt?: string | null;
  publishQueue?: Array<{
    id?: string;
    videoId?: string;
    platform?: 'tiktok' | 'instagram_reels' | 'youtube_shorts';
    channelId?: string | null;
    title?: string;
    description?: string;
    publishAt?: string;
    status?: 'draft' | 'scheduled' | 'ready' | 'published' | 'failed';
    publishedAt?: string | null;
    providerPostId?: string | null;
    publishedUrl?: string | null;
    lastAttemptAt?: string | null;
    errorMessage?: string | null;
    createdAt?: string;
    updatedAt?: string;
  }>;
};

type PublishQueueItem = {
  id: string;
  projectId: string;
  projectTitle: string;
  videoId: string;
  platform: 'tiktok' | 'instagram_reels' | 'youtube_shorts';
  channelId: string | null;
  title: string;
  description: string;
  publishAt: string;
  status: 'draft' | 'scheduled' | 'ready' | 'published' | 'failed';
  publishedAt: string | null;
  providerPostId: string | null;
  publishedUrl: string | null;
  lastAttemptAt: string | null;
  errorMessage: string | null;
  createdAt: string;
};

type ChannelItem = {
  id: string;
  platform: 'tiktok' | 'instagram_reels' | 'youtube_shorts';
  displayName: string;
  handle: string | null;
  status: 'connected' | 'disconnected';
  createdAt: string;
  updatedAt: string;
};

const initialForm: FormState = {
  name: '',
  productName: '',
  productDescription: '',
  sellingPoints: '',
  targetAudience: '',
  durationSeconds: '30',
  language: 'en',
  aspectRatio: 'vertical_9_16',
};

function formatStatus(status: string | null | undefined) {
  if (!status) return 'draft';
  return status.replace(/_/g, ' ');
}

function getProjectStatusMeta(status: string | null | undefined) {
  const normalized = (status ?? 'draft').toLowerCase();

  if (normalized === 'generating' || normalized === 'process_video_main' || normalized === 'process_video_parts_generation') {
    return {
      label: 'Rendering',
      description: 'Video generation is in progress.',
      chipClass: 'border-blue-400/30 bg-blue-500/10 text-blue-200',
      dotClass: 'bg-blue-400',
      pulse: true,
    };
  }

  if (
    normalized === 'scripts_generated' ||
    normalized === 'process_script' ||
    normalized === 'process_script_validate' ||
    normalized === 'process_audio' ||
    normalized === 'process_audio_validate' ||
    normalized === 'process_transcription' ||
    normalized === 'process_metadata' ||
    normalized === 'process_captions_video' ||
    normalized === 'process_images_generation'
  ) {
    return {
      label: 'Processing',
      description: 'The project is moving through the generation pipeline.',
      chipClass: 'border-violet-400/30 bg-violet-500/10 text-violet-200',
      dotClass: 'bg-violet-400',
      pulse: true,
    };
  }

  if (normalized === 'done' || normalized === 'completed') {
    return {
      label: 'Ready',
      description: 'The latest output is ready to review.',
      chipClass: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200',
      dotClass: 'bg-emerald-400',
      pulse: false,
    };
  }

  if (normalized === 'error' || normalized === 'failed' || normalized === 'cancelled') {
    return {
      label: normalized === 'cancelled' ? 'Cancelled' : 'Needs attention',
      description: 'This project needs a retry or review.',
      chipClass: 'border-rose-400/30 bg-rose-500/10 text-rose-200',
      dotClass: 'bg-rose-400',
      pulse: false,
    };
  }

  return {
    label: 'Queued',
    description: 'The task has been created and is waiting for the next action.',
    chipClass: 'border-zinc-700 bg-zinc-800/80 text-zinc-200',
    dotClass: 'bg-zinc-500',
    pulse: false,
  };
}

function formatBytes(value: string) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes <= 0) return 'Unknown size';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDurationShort(seconds: number | null | undefined) {
  if (!seconds || !Number.isFinite(seconds)) return '0:30';
  const mins = Math.floor(seconds / 60);
  const remain = seconds % 60;
  return `${mins}:${String(remain).padStart(2, '0')}`;
}

function formatAspectRatio(value: ProjectItem['aspectRatio']) {
  if (value === 'square_1_1') return '1:1';
  if (value === 'landscape_16_9') return '16:9';
  return '9:16';
}

function getLanguageMeta(language: ProjectItem['language']) {
  if (language === 'es') {
    return { flag: 'ES', label: 'Spanish' };
  }

  return { flag: 'EN', label: 'English' };
}

function getProjectCardTone(index: number) {
  const tones = [
    'from-violet-900/90 via-violet-800/70 to-fuchsia-800/60',
    'from-indigo-900/90 via-indigo-800/70 to-violet-800/60',
    'from-fuchsia-900/90 via-purple-800/70 to-violet-800/60',
    'from-rose-950/90 via-rose-800/70 to-red-800/60',
    'from-amber-950/90 via-orange-800/70 to-amber-700/60',
    'from-cyan-950/90 via-sky-800/70 to-blue-800/60',
  ] as const;

  return tones[index % tones.length];
}

function getTimeUntilExpiry(expiresAt: string) {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (!Number.isFinite(diff)) return null;
  if (diff <= 0) return 'Expired';
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 24) return `${hours}h left`;
  const days = Math.floor(hours / 24);
  return `${days}d left`;
}

function formatBytesCompact(value: string | number | bigint) {
  const bytes = typeof value === 'bigint' ? Number(value) : Number(value);
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`.replace('.00', '');
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`.replace('.00', '');
}

export function WorkspaceShell() {
  const { items, loading, refresh } = useProjects();
  const [workspaceSection, setWorkspaceSection] = useState<'projects' | 'assets'>('projects');
  const [form, setForm] = useState<FormState>(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [videosLoading, setVideosLoading] = useState(true);
  const [deletingVideoId, setDeletingVideoId] = useState<string | null>(null);
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(true);
  const [assetSummary, setAssetSummary] = useState<AssetSummary | null>(null);
  const [deletingAssetId, setDeletingAssetId] = useState<string | null>(null);
  const [assetFilter, setAssetFilter] = useState<'all' | 'image' | 'video' | 'hook'>('all');
  const [assetSearch, setAssetSearch] = useState('');
  const [videoToDelete, setVideoToDelete] = useState<VideoItem | null>(null);
  const [assetToDelete, setAssetToDelete] = useState<AssetItem | null>(null);
  const [projectFilter, setProjectFilter] = useState<'all' | 'active' | 'queued' | 'ready' | 'failed'>('all');
  const [projectSearch, setProjectSearch] = useState('');
  const [projectSort, setProjectSort] = useState<'newest' | 'oldest'>('newest');
  const [publishingItemId, setPublishingItemId] = useState<string | null>(null);
  const [publishingAllReady, setPublishingAllReady] = useState(false);
  const [channels, setChannels] = useState<ChannelItem[]>([]);
  const [channelsLoading, setChannelsLoading] = useState(true);
  const [creatingChannel, setCreatingChannel] = useState(false);
  const [startingTikTokOAuth, setStartingTikTokOAuth] = useState(false);
  const [updatingChannelId, setUpdatingChannelId] = useState<string | null>(null);
  const [deletingChannelId, setDeletingChannelId] = useState<string | null>(null);
  const [channelForm, setChannelForm] = useState({
    platform: 'tiktok' as 'tiktok' | 'instagram_reels' | 'youtube_shorts',
    displayName: '',
    handle: '',
  });

  const projectCountLabel = useMemo(() => `${items.length} project${items.length === 1 ? '' : 's'}`, [items.length]);
  const videoCountLabel = useMemo(() => `${videos.length} video${videos.length === 1 ? '' : 's'}`, [videos.length]);
  const filteredAssets = useMemo(() => {
    const normalizedSearch = assetSearch.trim().toLowerCase();
    return (assetFilter === 'all' ? assets : assets.filter((asset) => asset.type === assetFilter)).filter((asset) => {
      if (!normalizedSearch) return true;
      return (
        asset.filename.toLowerCase().includes(normalizedSearch) ||
        asset.project?.name?.toLowerCase().includes(normalizedSearch) === true
      );
    });
  }, [assets, assetFilter, assetSearch]);
  const groupedAssetProjects = useMemo(() => {
    const projectMap = new Map<
      string,
      {
        id: string;
        name: string;
        updatedAt: string;
        assets: AssetItem[];
      }
    >();

    filteredAssets.forEach((asset) => {
      const key = asset.project?.id ?? 'unassigned';
      const existing = projectMap.get(key);
      const assetTime = asset.createdAt ? new Date(asset.createdAt).getTime() : 0;

      if (existing) {
        existing.assets.push(asset);
        const existingTime = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
        if (assetTime > existingTime) existing.updatedAt = asset.createdAt;
        return;
      }

      projectMap.set(key, {
        id: key,
        name: asset.project?.name ?? 'Unassigned assets',
        updatedAt: asset.createdAt,
        assets: [asset],
      });
    });

    return Array.from(projectMap.values()).sort((a, b) => {
      const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return bTime - aTime;
    });
  }, [filteredAssets]);
  const assetCountLabel = useMemo(
    () => `${groupedAssetProjects.length} project${groupedAssetProjects.length === 1 ? '' : 's'}`,
    [groupedAssetProjects.length],
  );
  const filteredProjects = useMemo(() => {
    const normalizedSearch = projectSearch.trim().toLowerCase();

    return (items as ProjectItem[])
      .filter((item) => {
      const normalized = (item.status ?? '').toLowerCase();
      const title = (item.title || item.name || 'Untitled project').toLowerCase();
      if (normalizedSearch && !title.includes(normalizedSearch)) return false;
      if (projectFilter === 'all') return true;
      if (projectFilter === 'ready') return normalized === 'done' || normalized === 'completed';
      if (projectFilter === 'failed') return normalized === 'error' || normalized === 'failed' || normalized === 'cancelled';
      if (projectFilter === 'queued') return normalized === 'draft' || normalized === 'new';
      return (
        normalized === 'generating' ||
        normalized === 'scripts_generated' ||
        normalized === 'process_script' ||
        normalized === 'process_script_validate' ||
        normalized === 'process_audio' ||
        normalized === 'process_audio_validate' ||
        normalized === 'process_transcription' ||
        normalized === 'process_metadata' ||
        normalized === 'process_captions_video' ||
        normalized === 'process_images_generation' ||
        normalized === 'process_video_parts_generation' ||
        normalized === 'process_video_main'
      );
    })
      .sort((a, b) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return projectSort === 'oldest' ? aTime - bTime : bTime - aTime;
      });
  }, [items, projectFilter, projectSearch, projectSort]);
  const expiringVideos = useMemo(
    () =>
      videos.filter((video) => {
        const diff = new Date(video.expiresAt).getTime() - Date.now();
        return diff > 0 && diff <= 24 * 60 * 60 * 1000;
      }),
    [videos],
  );
  const publishQueueItems = useMemo<PublishQueueItem[]>(() => {
    return (items as ProjectItem[])
      .flatMap((project) =>
        (project.publishQueue ?? []).map((entry, index) => ({
          id: entry.id || `${project.id}-${entry.videoId || 'video'}-${entry.publishAt || index}`,
          projectId: project.id,
          projectTitle: project.title || project.name || 'Untitled project',
          videoId: entry.videoId || '',
          platform: entry.platform || 'tiktok',
          channelId: entry.channelId ?? null,
          title: entry.title?.trim() || 'Untitled post',
          description: entry.description?.trim() || '',
          publishAt: entry.publishAt || '',
          status: entry.status === 'ready'
            ? 'ready'
            : entry.status === 'published'
              ? 'published'
              : entry.status === 'failed'
                ? 'failed'
                : entry.status === 'scheduled'
                  ? 'scheduled'
                  : 'draft',
          publishedAt: entry.publishedAt ?? null,
          providerPostId: entry.providerPostId ?? null,
          publishedUrl: entry.publishedUrl ?? null,
          lastAttemptAt: entry.lastAttemptAt ?? null,
          errorMessage: entry.errorMessage ?? null,
          createdAt: entry.createdAt || '',
        })),
      )
      .sort((a, b) => {
        const aTime = a.publishAt ? new Date(a.publishAt).getTime() : 0;
        const bTime = b.publishAt ? new Date(b.publishAt).getTime() : 0;
        return bTime - aTime;
      });
  }, [items]);
  const publishCountLabel = useMemo(
    () => `${publishQueueItems.length} item${publishQueueItems.length === 1 ? '' : 's'}`,
    [publishQueueItems.length],
  );
  const channelCountLabel = useMemo(
    () => `${channels.length} channel${channels.length === 1 ? '' : 's'}`,
    [channels.length],
  );
  const readyPublishItems = useMemo(
    () => publishQueueItems.filter((item) => item.status === 'ready'),
    [publishQueueItems],
  );

  async function loadVideos() {
    setVideosLoading(true);
    try {
      const result = await Api.getVideos();
      setVideos(Array.isArray(result) ? (result as VideoItem[]) : []);
    } catch {
      setVideos([]);
    } finally {
      setVideosLoading(false);
    }
  }

  async function loadAssets() {
    setAssetsLoading(true);
    try {
      const [result, summary] = await Promise.all([
        Api.getAssets(),
        Api.getAssetSummary(),
      ]);
      setAssets(Array.isArray(result) ? (result as AssetItem[]) : []);
      setAssetSummary(summary);
    } catch {
      setAssets([]);
      setAssetSummary(null);
    } finally {
      setAssetsLoading(false);
    }
  }

  useEffect(() => {
    loadVideos();
    loadAssets();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const syncSection = () => {
      setWorkspaceSection(window.location.hash === '#assets-section' ? 'assets' : 'projects');
    };

    syncSection();
    window.addEventListener('hashchange', syncSection);
    return () => window.removeEventListener('hashchange', syncSection);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function loadChannels() {
    setChannelsLoading(true);
    try {
      const result = await Api.getChannels();
      setChannels(Array.isArray(result) ? (result as ChannelItem[]) : []);
    } catch {
      setChannels([]);
    } finally {
      setChannelsLoading(false);
    }
  }

  useEffect(() => {
    loadChannels();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    const channelOauth = url.searchParams.get('channelOauth');
    const platform = url.searchParams.get('platform');
    const message = url.searchParams.get('message');
    if (platform !== 'tiktok' || !channelOauth) return;

    if (channelOauth === 'success') {
      toast.success('TikTok channel connected');
      void loadChannels();
    } else if (channelOauth === 'error') {
      toast.error(message || 'TikTok connection failed');
    }

    url.searchParams.delete('channelOauth');
    url.searchParams.delete('platform');
    url.searchParams.delete('message');
    window.history.replaceState({}, '', url.toString());
  }, []);

  async function handleDeleteVideo(videoId: string) {
    setDeletingVideoId(videoId);
    try {
      await Api.deleteVideo(videoId);
      toast.success('Video deleted');
      await loadVideos();
    } catch (err: any) {
      toast.error(err?.error?.message || 'Could not delete the video. Please try again.');
    } finally {
      setDeletingVideoId(null);
      setVideoToDelete(null);
    }
  }

  async function handleDeleteAsset(assetId: string) {
    setDeletingAssetId(assetId);
    try {
      await Api.deleteAsset(assetId);
      toast.success('Asset deleted');
      await Promise.all([loadAssets(), refresh()]);
    } catch (err: any) {
      toast.error(err?.error?.message || 'Could not delete the asset. Please try again.');
    } finally {
      setDeletingAssetId(null);
      setAssetToDelete(null);
    }
  }

  async function handleCreateChannel(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreatingChannel(true);
    try {
      await Api.createChannel({
        platform: channelForm.platform,
        displayName: channelForm.displayName.trim(),
        handle: channelForm.handle.trim(),
      });
      toast.success('Channel created');
      setChannelForm({ platform: 'tiktok', displayName: '', handle: '' });
      await loadChannels();
    } catch (err: any) {
      toast.error(err?.error?.message || 'Could not create channel. Please try again.');
    } finally {
      setCreatingChannel(false);
    }
  }

  async function handleConnectTikTok() {
    setStartingTikTokOAuth(true);
    try {
      const result = await Api.startTikTokChannelOAuth();
      const authUrl = (result as { authUrl?: string }).authUrl;
      if (!authUrl) {
        throw new Error('TikTok OAuth URL is missing.');
      }
      window.location.assign(authUrl);
    } catch (err: any) {
      toast.error(err?.error?.message || err?.message || 'Could not start TikTok connection.');
      setStartingTikTokOAuth(false);
    }
  }

  async function handleToggleChannelStatus(channel: ChannelItem) {
    setUpdatingChannelId(channel.id);
    try {
      await Api.updateChannel(channel.id, {
        status: channel.status === 'connected' ? 'disconnected' : 'connected',
      });
      toast.success(channel.status === 'connected' ? 'Channel disconnected' : 'Channel reconnected');
      await loadChannels();
    } catch (err: any) {
      toast.error(err?.error?.message || 'Could not update channel status. Please try again.');
    } finally {
      setUpdatingChannelId(null);
    }
  }

  async function handleDeleteChannel(channelId: string) {
    setDeletingChannelId(channelId);
    try {
      await Api.deleteChannel(channelId);
      toast.success('Channel deleted');
      await loadChannels();
    } catch (err: any) {
      toast.error(err?.error?.message || 'Could not delete channel. Please try again.');
    } finally {
      setDeletingChannelId(null);
    }
  }

  async function handlePublishQueueItem(item: PublishQueueItem) {
    setPublishingItemId(item.id);
    try {
      await Api.publishProjectQueueItem(item.projectId, item.id);
      toast.success(item.status === 'failed' ? 'Publish task retried' : 'Publish task marked as published');
      await refresh();
    } catch (err: any) {
      toast.error(err?.error?.message || 'Could not publish this task. Please try again.');
      await refresh();
    } finally {
      setPublishingItemId(null);
    }
  }

  async function handlePublishAllReady() {
    if (readyPublishItems.length === 0) return;
    setPublishingAllReady(true);
    try {
      for (const item of readyPublishItems) {
        await Api.publishProjectQueueItem(item.projectId, item.id);
      }
      toast.success('All ready publish tasks were processed');
      await refresh();
    } catch (err: any) {
      toast.error(err?.error?.message || 'One or more publish tasks failed to process.');
      await refresh();
    } finally {
      setPublishingAllReady(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        durationSeconds: Number(form.durationSeconds),
      };
      const created = await Api.createProject(payload);
      toast.success('Project created');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('project:created', { detail: created }));
      }
      setForm(initialForm);
      refresh();
      loadVideos();
      loadAssets();
    } catch (err: any) {
      toast.error(err?.error?.message || 'Failed to create project');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      {workspaceSection === 'projects' ? (
        <Card id="projects-section" className="border-zinc-800 bg-transparent shadow-none">
            <CardHeader className="flex-col items-start gap-2">
              <div>
                <CardTitle className="text-3xl font-semibold tracking-tight text-zinc-100">Projects</CardTitle>
                <CardDescription className="mt-2 text-sm text-zinc-400">
                  All your generated videos and finished outputs.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-5 px-0">
              {items.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-zinc-800 px-4 py-10 text-sm text-zinc-500">
                  No projects yet.
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-violet-500/20 bg-violet-500/10 px-4 py-3 text-sm text-violet-100">
                    <div className="flex flex-wrap items-start gap-3">
                      <Languages className="mt-0.5 h-4 w-4 shrink-0 text-violet-300" />
                      <p className="leading-6">
                        Free supports English and 30-second videos with watermark. Upgrade to unlock Spanish, longer durations, longer retention, hook uploads, and cleaner outputs.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                    <div className="flex flex-1 flex-col gap-3 lg:flex-row lg:items-center">
                      <div className="relative w-full max-w-xl">
                        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                        <Input
                          value={projectSearch}
                          onChange={(event) => setProjectSearch(event.target.value)}
                          placeholder="Search videos..."
                          className="w-full rounded-2xl border-zinc-700 bg-zinc-900 py-3 pl-11 text-zinc-100 placeholder:text-zinc-500"
                        />
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                    {[
                      { value: 'all' as const, label: 'All' },
                      { value: 'active' as const, label: 'Rendering' },
                      { value: 'queued' as const, label: 'Queued' },
                      { value: 'ready' as const, label: 'Ready' },
                      { value: 'failed' as const, label: 'Failed' },
                    ].map((filter, index) => (
                      <button
                        key={`${filter.label}-${index}`}
                        type="button"
                        onClick={() => setProjectFilter(filter.value)}
                        className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                          projectFilter === filter.value
                            ? 'border-blue-400/40 bg-blue-500/10 text-blue-200'
                            : 'border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200'
                        }`}
                      >
                        {filter.label}
                      </button>
                    ))}
                      </div>
                    </div>

                    <div className="w-full max-w-[180px]">
                      <Select value={projectSort} onValueChange={(value: 'newest' | 'oldest') => setProjectSort(value)}>
                        <SelectTrigger className="rounded-2xl border-zinc-700 bg-zinc-900 text-zinc-100">
                          <SelectValue placeholder="Sort projects" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="newest">Newest first</SelectItem>
                          <SelectItem value="oldest">Oldest first</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {expiringVideos.length > 0 ? (
                    <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                      <div className="flex flex-wrap items-start gap-3">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                        <p className="leading-6">
                          Videos expiring soon: {expiringVideos.length} file{expiringVideos.length === 1 ? '' : 's'} expire within 24 hours. Download them before they are permanently removed.
                        </p>
                      </div>
                    </div>
                  ) : null}

                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                  {filteredProjects.map((item: any, index) => {
                    const statusMeta = getProjectStatusMeta(item.status);
                    const languageMeta = getLanguageMeta(item.language);
                    const relatedVideos = videos.filter((video) => video.project.id === item.id);
                    const relatedVideo = relatedVideos[0] ?? null;
                    const variantCount = relatedVideos.length;
                    const expiryLabel = relatedVideo ? getTimeUntilExpiry(relatedVideo.expiresAt) : null;
                    const tone = getProjectCardTone(index);
                    const isReady = statusMeta.label === 'Ready';
                    const isFailed = statusMeta.label === 'Needs attention';
                    const isRendering = statusMeta.label === 'Rendering' || statusMeta.label === 'Processing' || statusMeta.label === 'Queued';

                    return (
                      <Link
                        key={item.id}
                        href={`/project/${item.id}`}
                        className="group block min-w-0 overflow-hidden rounded-[24px] border border-zinc-800 bg-zinc-900/80 transition-all hover:border-zinc-700"
                      >
                        <div className={`relative h-40 border-b border-zinc-800 bg-gradient-to-br ${tone}`}>
                          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_40%)]" />
                          <div className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-lg bg-black/35 px-2 py-1 text-[11px] font-semibold text-zinc-100 backdrop-blur">
                            <Film className="h-3.5 w-3.5" />
                            {formatAspectRatio(item.aspectRatio)}
                          </div>
                          <div className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-lg bg-black/35 px-2 py-1 text-[11px] font-semibold text-zinc-100 backdrop-blur">
                            <Clock3 className="h-3.5 w-3.5" />
                            {formatDurationShort(item.durationSeconds)}
                          </div>
                          <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-2">
                            <div className="inline-flex items-center gap-1.5 rounded-full bg-black/35 px-2.5 py-1 text-[11px] font-semibold text-zinc-100 backdrop-blur">
                              <span>{languageMeta.flag}</span>
                              <span>{languageMeta.label}</span>
                            </div>
                            {(item.durationSeconds ?? 0) > 30 || item.language === 'es' ? (
                              <div className="inline-flex items-center gap-1.5 rounded-full bg-black/35 px-2.5 py-1 text-[11px] font-semibold text-amber-100 backdrop-blur">
                                <Lock className="h-3.5 w-3.5" />
                                Plan gated
                              </div>
                            ) : null}
                          </div>
                        </div>

                        <div className="space-y-3 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="truncate text-base font-semibold text-zinc-100">
                                {item.title || item.name || 'Untitled project'}
                              </div>
                              <div className="mt-1 text-sm text-zinc-500">
                                {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'Unknown date'}
                              </div>
                            </div>
                            <button
                              type="button"
                              className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-200"
                              onClick={(event) => event.preventDefault()}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-medium ${statusMeta.chipClass}`}>
                              <span className={`h-2 w-2 rounded-full ${statusMeta.dotClass} ${statusMeta.pulse ? 'animate-pulse' : ''}`} />
                              <span>{statusMeta.label}</span>
                            </span>
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-[11px] font-medium text-zinc-300">
                              <Film className="h-3.5 w-3.5" />
                              {variantCount} variant{variantCount === 1 ? '' : 's'}
                            </span>
                            {relatedVideo ? (
                              <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-[11px] font-medium text-zinc-300">
                                {relatedVideo.downloadCount > 0 ? <Download className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
                                {relatedVideo.downloadCount} downloads
                              </span>
                            ) : null}
                          </div>

                          <div className="grid gap-2 text-sm text-zinc-400">
                            <div className="flex items-center justify-between gap-3">
                              <span>{statusMeta.description}</span>
                              <span className="shrink-0 text-zinc-500">{formatStatus(item.status)}</span>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <span>{relatedVideo ? `Expires ${new Date(relatedVideo.expiresAt).toLocaleDateString()}` : 'No final video yet'}</span>
                              <span className={`${expiryLabel === 'Expired' ? 'text-rose-300' : 'text-zinc-500'}`}>
                                {expiryLabel || ''}
                              </span>
                            </div>
                          </div>

                          <div className="space-y-3 border-t border-zinc-800 pt-3">
                            {isReady && relatedVideo ? (
                              <div className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm font-medium text-zinc-100 transition hover:border-zinc-600 hover:bg-zinc-800">
                                <Download className="h-4 w-4" />
                                Download MP4
                                <span className="text-zinc-500">{formatBytes(relatedVideo.fileSizeBytes)}</span>
                              </div>
                            ) : isFailed ? (
                              <div className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-2.5 text-sm font-medium text-rose-100">
                                <AlertTriangle className="h-4 w-4" />
                                Render failed
                              </div>
                            ) : isRendering ? (
                              <div className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm font-medium text-zinc-300">
                                <Clock3 className="h-4 w-4" />
                                {statusMeta.label}
                              </div>
                            ) : null}

                            <div className="flex items-center justify-between gap-3 text-xs text-zinc-500">
                              <div className="flex items-center gap-2">
                                {relatedVideo ? (
                                  <>
                                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />
                                    {relatedVideo.downloadCount > 0 ? 'Viewed in workspace' : 'Ready to review'}
                                  </>
                                ) : (
                                  <>
                                    <ChevronDown className="h-3.5 w-3.5" />
                                    Open project
                                  </>
                                )}
                              </div>
                              {relatedVideo ? <span>{new Date(relatedVideo.createdAt).toLocaleDateString()}</span> : null}
                            </div>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
      ) : (
        <Card id="assets-section" className="border-zinc-800 bg-transparent shadow-none">
          <CardHeader className="flex-col items-start gap-3">
            <div>
              <CardTitle className="text-3xl font-semibold tracking-tight text-zinc-100">My Assets</CardTitle>
              <CardDescription className="mt-2 text-sm text-zinc-400">
                Your uploaded media, product info history, and reusable materials.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-5 px-0">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                <span className="font-medium text-zinc-200">Storage used</span>
                <div className="flex items-center gap-3 text-zinc-400">
                  <span className="font-medium text-zinc-100">
                    {assetSummary ? formatBytesCompact(assetSummary.usedBytes) : '0 MB'} / {assetSummary ? formatBytesCompact(assetSummary.storageLimitBytes) : '0 GB'}
                  </span>
                  <span>{assetSummary?.assetCount ?? assets.length} files</span>
                </div>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-zinc-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-500"
                  style={{
                    width: assetSummary
                      ? `${Math.min(
                          100,
                          (Number(assetSummary.usedBytes) / Math.max(Number(assetSummary.storageLimitBytes), 1)) * 100,
                        )}%`
                      : '0%',
                  }}
                />
              </div>
            </div>

            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex flex-1 flex-col gap-3 lg:flex-row lg:items-center">
                <div className="relative w-full max-w-xl">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                  <Input
                    value={assetSearch}
                    onChange={(event) => setAssetSearch(event.target.value)}
                    placeholder="Search assets..."
                    className="w-full rounded-2xl border-zinc-700 bg-zinc-900 py-3 pl-11 text-zinc-100 placeholder:text-zinc-500"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {[
                    { value: 'all' as const, label: 'All', icon: Grid2X2 },
                    { value: 'video' as const, label: 'Videos', icon: Video },
                    { value: 'image' as const, label: 'Images', icon: ImageIcon },
                    { value: 'hook' as const, label: 'Hook', icon: Film },
                  ].map(({ value, label, icon: Icon }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setAssetFilter(value)}
                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                        assetFilter === value
                          ? 'border-blue-400/40 bg-blue-500/10 text-blue-200'
                          : 'border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200'
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="inline-flex rounded-2xl border border-zinc-700 bg-zinc-900 p-1 text-zinc-400">
                  <button type="button" className="rounded-xl bg-zinc-800 px-3 py-2 text-zinc-100">
                    <Grid2X2 className="h-4 w-4" />
                  </button>
                </div>
                <Button asChild variant="outline" className="rounded-2xl border-zinc-700 bg-zinc-900 text-zinc-100 hover:border-zinc-600 hover:bg-zinc-800">
                  <Link href="/create">
                    <Upload className="mr-2 h-4 w-4" />
                    Upload
                  </Link>
                </Button>
              </div>
            </div>

            <div className="rounded-2xl border-2 border-dashed border-zinc-800 bg-zinc-950/60 px-5 py-6 text-sm text-zinc-500">
              <div className="flex flex-wrap items-center gap-3">
                <Upload className="h-4 w-4" />
                <span>Drop files here to upload</span>
                <span>•</span>
                <span>MP4, MOV, JPG, PNG, GIF</span>
                <span>•</span>
                <Link href="/create" className="font-medium text-zinc-300 hover:text-zinc-100">
                  Open Create Task to attach assets
                </Link>
              </div>
            </div>

            {groupedAssetProjects.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-zinc-800 px-4 py-10 text-sm text-zinc-500">
                No assets found for this filter.
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {groupedAssetProjects.map((group, index) => {
                  const previewTone = getProjectCardTone(index);
                  const images = group.assets.filter((asset) => asset.type === 'image' || asset.mimeType.startsWith('image'));
                  const videosInGroup = group.assets.filter((asset) => asset.type === 'video' || asset.type === 'hook' || asset.mimeType.startsWith('video'));
                  const totalUsageCount = group.assets.reduce((sum, asset) => sum + (asset.usageCount ?? 0), 0);
                  const latestExpiry = group.assets
                    .map((asset) => asset.expiresAt)
                    .filter(Boolean)
                    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0];
                  const expiryLabel = latestExpiry ? getTimeUntilExpiry(latestExpiry) : null;
                  const previewAssets = group.assets.slice(0, 4);
                  const canOpenProject = group.id !== 'unassigned';

                  return (
                    <Link
                      key={group.id}
                      href={canOpenProject ? `/project/${group.id}` : '/workspace#assets-section'}
                      className="overflow-hidden rounded-[24px] border border-zinc-800 bg-zinc-900/80 transition-all hover:border-zinc-700"
                    >
                      <div className={`relative h-40 border-b border-zinc-800 bg-gradient-to-br ${previewTone}`}>
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_40%)]" />
                        <div className="absolute inset-0 grid grid-cols-2 gap-1 p-3">
                          {previewAssets.map((assetPreview) => {
                            const isVideoAsset = assetPreview.type === 'video' || assetPreview.type === 'hook' || assetPreview.mimeType.startsWith('video');
                            return (
                              <div
                                key={assetPreview.id}
                                className="flex items-center justify-center rounded-xl border border-white/10 bg-black/20 backdrop-blur-sm"
                              >
                                {isVideoAsset ? (
                                  <Video className="h-6 w-6 text-zinc-200/75" />
                                ) : (
                                  <ImageIcon className="h-6 w-6 text-zinc-200/75" />
                                )}
                              </div>
                            );
                          })}
                          {previewAssets.length === 0 ? (
                            <div className="col-span-2 flex items-center justify-center rounded-xl border border-white/10 bg-black/20 backdrop-blur-sm">
                              <Grid2X2 className="h-7 w-7 text-zinc-200/70" />
                            </div>
                          ) : null}
                        </div>
                        <div className="absolute bottom-3 left-3 rounded-lg bg-black/35 px-2 py-1 text-[11px] font-semibold text-zinc-100 backdrop-blur">
                          {group.assets.length} asset{group.assets.length === 1 ? '' : 's'}
                        </div>
                      </div>

                      <div className="space-y-3 p-4">
                        <div className="truncate text-base font-semibold text-zinc-100">{group.name}</div>
                        <div className="flex items-center justify-between gap-3 text-sm text-zinc-500">
                          <span>{images.length} images</span>
                          <span>{videosInGroup.length} videos</span>
                        </div>
                        <div className="flex items-center justify-between gap-3 text-sm text-zinc-400">
                          <span>x{totalUsageCount} reuse</span>
                          <span className={expiryLabel === 'Expired' ? 'text-rose-300' : 'text-zinc-500'}>
                            {expiryLabel || ''}
                          </span>
                        </div>
                        <div className="border-t border-zinc-800 pt-3 text-xs text-zinc-500">
                          Updated {group.updatedAt ? new Date(group.updatedAt).toLocaleDateString() : 'recently'}
                        </div>
                        <div className="flex items-center justify-between gap-2 text-sm text-zinc-300">
                          <span>{canOpenProject ? 'Open project assets' : 'Review unassigned assets'}</span>
                          <span className="text-zinc-500">{group.assets.length} files</span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={!!videoToDelete} onOpenChange={(open) => !open && setVideoToDelete(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader className="flex-col items-start gap-1 text-left">
            <DialogTitle>Delete video?</DialogTitle>
            <DialogDescription>
              This will remove the generated video from your workspace and storage. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 sm:justify-end">
            <Button variant="outline" onClick={() => setVideoToDelete(null)} disabled={!!deletingVideoId}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => videoToDelete && void handleDeleteVideo(videoToDelete.id)}
              disabled={!!deletingVideoId}
            >
              {deletingVideoId ? 'Deleting...' : 'Delete video'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!assetToDelete} onOpenChange={(open) => !open && setAssetToDelete(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader className="flex-col items-start gap-1 text-left">
            <DialogTitle>Delete asset?</DialogTitle>
            <DialogDescription>
              This will remove the asset from your library, storage, and any current project selections that use it.
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 sm:justify-end">
            <Button variant="outline" onClick={() => setAssetToDelete(null)} disabled={!!deletingAssetId}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => assetToDelete && void handleDeleteAsset(assetToDelete.id)}
              disabled={!!deletingAssetId}
            >
              {deletingAssetId ? 'Deleting...' : 'Delete asset'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
