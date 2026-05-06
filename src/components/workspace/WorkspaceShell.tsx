"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  AlertTriangle,
  Download,
  Film,
  Grid2X2,
  Image as ImageIcon,
  MoreHorizontal,
  Plus,
  Search,
  RefreshCw,
  Trash2,
  Video,
} from 'lucide-react';
import { Api } from '@/lib/api-client';
import { useProjects } from '@/components/providers/ProjectsProvider';
import { MediaThumbnail } from '@/components/media/MediaThumbnail';
import { normalizeProjectDisplayStatus } from '@/shared/project-status';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRouter } from 'next/navigation';

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
  storageUrl: string;
  thumbnailUrl: string | null;
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
  latestVideo?: {
    id: string;
    storageUrl: string;
    thumbnailUrl: string | null;
    fileSizeBytes: string;
  } | null;
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

function getProjectStatusMeta(status: string | null | undefined) {
  const normalized = normalizeProjectDisplayStatus(status);

  if (normalized === 'done') {
    return {
      key: 'done' as const,
      label: 'Done',
      badgeClass: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200',
      progress: null,
    };
  }

  if (normalized === 'failed') {
    return {
      key: 'failed' as const,
      label: 'Failed',
      badgeClass: 'border-rose-400/30 bg-rose-500/10 text-rose-200',
      progress: null,
    };
  }

  if (normalized === 'pending') {
    return {
      key: 'pending' as const,
      label: 'Pending',
      badgeClass: 'border-zinc-700 bg-zinc-800/80 text-zinc-200',
      progress: null,
    };
  }

  return {
    key: 'processing' as const,
    label: 'Processing',
    badgeClass: 'border-blue-400/30 bg-blue-500/10 text-blue-200',
    progress: 56,
  };
}

function formatBytes(value: string) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes <= 0) return 'Unknown size';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatAspectRatio(value: ProjectItem['aspectRatio']) {
  if (value === 'square_1_1') return '1:1';
  if (value === 'landscape_16_9') return '16:9';
  return '9:16';
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

function formatProjectDate(value: string | null | undefined) {
  if (!value) return 'Unknown date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown date';
  const month = new Intl.DateTimeFormat('en-US', { month: 'short' }).format(date);
  const day = date.getDate();
  const year = date.getFullYear();
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const period = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${month} ${day},${year},${hours}:${minutes}${period}`;
}

function getProjectStatusText(statusKey: ReturnType<typeof getProjectStatusMeta>['key']) {
  if (statusKey === 'pending') return 'Waiting to start';
  if (statusKey === 'processing') return 'Generating video';
  if (statusKey === 'failed') return 'Generation failed';
  return 'Ready to review';
}

function getProjectMenuActions(statusKey: ReturnType<typeof getProjectStatusMeta>['key'], hasVideo: boolean) {
  if (statusKey === 'pending') return ['delete'] as const;
  if (statusKey === 'processing') return ['delete'] as const;
  if (statusKey === 'failed') return ['retry', 'delete'] as const;
  if (statusKey === 'done') return hasVideo ? (['view', 'download', 'delete'] as const) : (['view', 'delete'] as const);
  return [] as const;
}

function PaginationControls({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/70 px-4 py-3">
      <div className="text-xs font-medium text-zinc-500">
        Page {page} of {totalPages}
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-xl border-zinc-700 bg-zinc-950 text-zinc-100 hover:border-zinc-600 hover:bg-zinc-900"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-xl border-zinc-700 bg-zinc-950 text-zinc-100 hover:border-zinc-600 hover:bg-zinc-900"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

export function WorkspaceShell({ section = 'projects' }: { section?: 'projects' | 'assets' }) {
  const router = useRouter();
  const { items, loading, refresh } = useProjects();
  const [form, setForm] = useState<FormState>(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [videosLoading, setVideosLoading] = useState(true);
  const [deletingVideoId, setDeletingVideoId] = useState<string | null>(null);
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(true);
  const [deletingAssetId, setDeletingAssetId] = useState<string | null>(null);
  const [assetFilter, setAssetFilter] = useState<'all' | 'image' | 'video' | 'hook'>('all');
  const [assetSearch, setAssetSearch] = useState('');
  const [videoToDelete, setVideoToDelete] = useState<VideoItem | null>(null);
  const [assetToDelete, setAssetToDelete] = useState<AssetItem | null>(null);
  const [projectToDelete, setProjectToDelete] = useState<ProjectItem | null>(null);
  const [projectFilter, setProjectFilter] = useState<'all' | 'active' | 'pending' | 'done' | 'failed'>('all');
  const [projectSearch, setProjectSearch] = useState('');
  const [projectSort, setProjectSort] = useState<'newest' | 'oldest'>('newest');
  const [projectPage, setProjectPage] = useState(1);
  const [assetPage, setAssetPage] = useState(1);
  const [projectMenuOpenId, setProjectMenuOpenId] = useState<string | null>(null);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);
  const [retryingProjectId, setRetryingProjectId] = useState<string | null>(null);
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

  useEffect(() => {
    if (!projectMenuOpenId || typeof document === 'undefined') return;

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest(`[data-project-menu-root="${projectMenuOpenId}"]`)) return;
      setProjectMenuOpenId(null);
    }

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [projectMenuOpenId]);

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
      const normalized = normalizeProjectDisplayStatus(item.status);
      const title = (item.title || item.name || 'Untitled project').toLowerCase();
      if (normalizedSearch && !title.includes(normalizedSearch)) return false;
      if (projectFilter === 'all') return true;
      if (projectFilter === 'done') return normalized === 'done';
      if (projectFilter === 'failed') return normalized === 'failed';
      if (projectFilter === 'pending') return normalized === 'pending';
      return normalized === 'pending' || normalized === 'processing';
    })
      .sort((a, b) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return projectSort === 'oldest' ? aTime - bTime : bTime - aTime;
      });
  }, [items, projectFilter, projectSearch, projectSort]);
  const paginatedProjects = useMemo(() => {
    const start = (projectPage - 1) * 20;
    return filteredProjects.slice(start, start + 20);
  }, [filteredProjects, projectPage]);
  const totalProjectPages = Math.max(1, Math.ceil(filteredProjects.length / 20));
  const paginatedAssetGroups = useMemo(() => {
    const start = (assetPage - 1) * 20;
    return groupedAssetProjects.slice(start, start + 20);
  }, [groupedAssetProjects, assetPage]);
  const totalAssetPages = Math.max(1, Math.ceil(groupedAssetProjects.length / 20));
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
      const result = await Api.getAssets();
      setAssets(Array.isArray(result) ? (result as AssetItem[]) : []);
    } catch {
      setAssets([]);
    } finally {
      setAssetsLoading(false);
    }
  }

  useEffect(() => {
    loadVideos();
    loadAssets();
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
    setProjectPage(1);
  }, [projectFilter, projectSearch, projectSort]);

  useEffect(() => {
    setAssetPage(1);
  }, [assetFilter, assetSearch]);

  useEffect(() => {
    if (projectPage > totalProjectPages) {
      setProjectPage(totalProjectPages);
    }
  }, [projectPage, totalProjectPages]);

  useEffect(() => {
    if (assetPage > totalAssetPages) {
      setAssetPage(totalAssetPages);
    }
  }, [assetPage, totalAssetPages]);

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

  async function handleDeleteProject(projectId: string) {
    setProjectToDelete(null);
    setProjectMenuOpenId(null);
    setDeletingProjectId(projectId);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('project:deleted', { detail: { projectId } }));
    }
    try {
      await Api.deleteProject(projectId);
      toast.success('Project deleted');
      await Promise.all([refresh(), loadVideos(), loadAssets()]);
    } catch (err: any) {
      toast.error(err?.error?.message || 'Could not delete the project. Please try again.');
      await Promise.all([refresh(), loadVideos(), loadAssets()]);
    } finally {
      setDeletingProjectId(null);
    }
  }

  async function handleRetryProject(projectId: string) {
    setRetryingProjectId(projectId);
    try {
      await Api.createVideoJobs(projectId, { overwrite: true });
      toast.success('Project queued for rendering');
      await Promise.all([refresh(), loadVideos()]);
    } catch (err: any) {
      toast.error(err?.error?.message || 'Could not restart this project. Please try again.');
    } finally {
      setRetryingProjectId(null);
      setProjectMenuOpenId(null);
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
      {section === 'projects' ? (
        <Card id="projects-section" className="border-zinc-800 bg-transparent shadow-none">
            <CardHeader className="flex-col items-start gap-2 pb-0">
              <div>
                <CardTitle className="text-3xl font-semibold tracking-tight text-zinc-100">Projects</CardTitle>
                <CardDescription className="mt-2 text-sm text-zinc-400">
                  All your generated videos
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-6 px-0">
              {items.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-zinc-800 px-4 py-10 text-sm text-zinc-500">
                  No projects yet.
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_180px] xl:items-center xl:gap-4">
                    <div className="flex min-w-0 flex-col gap-6 lg:flex-row lg:items-center xl:pr-2">
                      <div className="relative w-full max-w-xl">
                        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                        <Input
                          value={projectSearch}
                          onChange={(event) => setProjectSearch(event.target.value)}
                          placeholder="Search videos..."
                          className="w-full rounded-2xl border-zinc-700 bg-zinc-900 py-3 pl-11 text-zinc-100 placeholder:text-zinc-500"
                        />
                      </div>
                      <div className="flex min-w-0 flex-nowrap items-center gap-1.5 overflow-x-auto pb-1 pr-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                    {[
                      { value: 'all' as const, label: 'All' },
                      { value: 'active' as const, label: 'Processing' },
                      { value: 'pending' as const, label: 'Pending' },
                      { value: 'done' as const, label: 'Done' },
                      { value: 'failed' as const, label: 'Failed' },
                    ].map((filter, index) => (
                      <button
                        key={`${filter.label}-${index}`}
                        type="button"
                        onClick={() => setProjectFilter(filter.value)}
                        className={`shrink-0 rounded-full border px-2.5 py-1.5 text-[11px] font-medium whitespace-nowrap transition ${
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

                    <div className="w-full max-w-[180px] justify-self-end">
                      <Select value={projectSort} onValueChange={(value: 'newest' | 'oldest') => setProjectSort(value)}>
                        <SelectTrigger className="rounded-2xl border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-900 focus:ring-0 focus:ring-offset-0 data-[state=open]:bg-zinc-900">
                          <SelectValue placeholder="Sort projects" />
                        </SelectTrigger>
                        <SelectContent className="border-zinc-800 bg-zinc-950 text-zinc-100">
                          <SelectItem
                            value="newest"
                            className="text-zinc-100 data-[highlighted]:bg-zinc-900 data-[highlighted]:text-zinc-100 focus:bg-zinc-900 focus:text-zinc-100"
                          >
                            Newest first
                          </SelectItem>
                          <SelectItem
                            value="oldest"
                            className="text-zinc-100 data-[highlighted]:bg-zinc-900 data-[highlighted]:text-zinc-100 focus:bg-zinc-900 focus:text-zinc-100"
                          >
                            Oldest first
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                  {paginatedProjects.map((item: any, index) => {
                    const statusMeta = getProjectStatusMeta(item.status);
                    const relatedVideos = videos.filter((video) => video.project.id === item.id);
                    const relatedVideo = relatedVideos[0] ?? item.latestVideo ?? null;
                    const tone = getProjectCardTone(index);
                    const title = item.title || item.name || 'Untitled project';
                    const isReady = statusMeta.key === 'done';
                    const menuActions = getProjectMenuActions(statusMeta.key, Boolean(relatedVideo));

                    const showOverlay = statusMeta.key === 'processing' || statusMeta.key === 'pending';
                    const isMenuOpen = projectMenuOpenId === item.id;

                    const cardBody = (
                      <>
                        <div className={`relative h-44 overflow-hidden rounded-t-[23px] border-b border-zinc-800 bg-gradient-to-br ${tone}`}>
                          {relatedVideo ? (
                            <MediaThumbnail
                              kind="video"
                              src={relatedVideo.storageUrl}
                              poster={relatedVideo.thumbnailUrl}
                              alt={`${title} preview`}
                              className="absolute inset-0 h-full w-full rounded-t-[23px] object-cover"
                              imageClassName="absolute inset-0 h-full w-full rounded-t-[23px] object-cover"
                              videoClassName="absolute inset-0 h-full w-full rounded-t-[23px] object-cover"
                              iconClassName="h-8 w-8 text-zinc-300/70"
                            />
                          ) : null}
                          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.12),transparent_45%)]" />
                          <div className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-lg bg-black/35 px-2 py-1 text-[11px] font-semibold text-zinc-100 backdrop-blur">
                            <Film className="h-3.5 w-3.5" />
                            {formatAspectRatio(item.aspectRatio)}
                          </div>

                          {showOverlay ? (
                            <div className="absolute inset-0 flex flex-col justify-end bg-zinc-950/55 p-4">
                              <div className="max-w-[80%]">
                                <p className="text-sm font-semibold text-zinc-100">{getProjectStatusText(statusMeta.key)}</p>
                                <p className="mt-1 text-xs text-zinc-300/90">
                                  {statusMeta.key === 'pending'
                                    ? 'This task is in line and will start generating shortly.'
                                    : 'We are assembling the next video version for this task.'}
                              </p>
                            </div>
                            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/15">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-blue-400 via-violet-400 to-indigo-300 transition-[width] duration-500"
                                  style={{ width: `${statusMeta.key === 'pending' ? 18 : statusMeta.progress ?? 0}%` }}
                              />
                            </div>
                          </div>
                          ) : null}
                        </div>

                        <div className="space-y-4 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="truncate text-base font-semibold text-zinc-100">{title}</div>
                              <div className="mt-1 text-xs text-zinc-500">
                                {formatProjectDate(item.createdAt)}
                              </div>
                            </div>
                            {menuActions.length > 0 ? (
                              <div className="relative shrink-0" data-project-menu-root={item.id}>
                                <button
                                  type="button"
                                  className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-200"
                                  onClick={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    setProjectMenuOpenId((current) => (current === item.id ? null : item.id));
                                  }}
                                  aria-label="Project actions"
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </button>
                                {isMenuOpen ? (
                                  <div
                                    className="absolute right-0 top-full z-20 mt-2 w-[156px] rounded-2xl border border-zinc-800 bg-zinc-950 p-1.5 text-zinc-100 shadow-2xl"
                                    onClick={(event) => event.stopPropagation()}
                                  >
                                    <div className="space-y-1">
                                      {menuActions.includes('view') ? (
                                        <Link
                                          href={`/project/${item.id}`}
                                          className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-zinc-200 transition hover:bg-zinc-900"
                                          onClick={() => setProjectMenuOpenId(null)}
                                        >
                                          <Video className="h-4 w-4" />
                                          <span>View</span>
                                        </Link>
                                      ) : null}
                                      {menuActions.includes('download') && relatedVideo ? (
                                        <a
                                          href={`/api/videos/${relatedVideo.id}/download`}
                                          className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-zinc-200 transition hover:bg-zinc-900"
                                          onClick={() => setProjectMenuOpenId(null)}
                                        >
                                          <Download className="h-4 w-4" />
                                          <span>Download</span>
                                        </a>
                                      ) : null}
                                      {menuActions.includes('retry') ? (
                                        <button
                                          type="button"
                                          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-zinc-200 transition hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-50"
                                          onClick={() => void handleRetryProject(item.id)}
                                          disabled={retryingProjectId === item.id}
                                        >
                                          <RefreshCw className={`h-4 w-4 ${retryingProjectId === item.id ? 'animate-spin' : ''}`} />
                                          <span>{retryingProjectId === item.id ? 'Retrying...' : 'Retry'}</span>
                                        </button>
                                      ) : null}
                                      {menuActions.includes('delete') ? (
                                        <button
                                          type="button"
                                          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-rose-300 transition hover:bg-rose-500/10"
                                          onClick={() => {
                                            setProjectMenuOpenId(null);
                                            setProjectToDelete(item);
                                          }}
                                        >
                                          <Trash2 className="h-4 w-4" />
                                          <span>Delete</span>
                                        </button>
                                      ) : null}
                                    </div>
                                  </div>
                                ) : null}
                              </div>
                            ) : null}
                          </div>

                          <div className="flex items-center justify-between gap-3">
                            <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium ${statusMeta.badgeClass}`}>
                              {statusMeta.label}
                            </span>
                            {relatedVideo && statusMeta.key === 'done' ? (
                              <span className="text-xs font-medium text-zinc-500">{formatBytes(relatedVideo.fileSizeBytes)}</span>
                            ) : null}
                          </div>
                        </div>
                      </>
                    );

                    return (
                      <div
                        key={item.id}
                        onClick={isReady ? () => router.push(`/project/${item.id}`) : undefined}
                        className={`group relative w-full min-w-0 rounded-[24px] border bg-zinc-900/80 transition-all ${
                          isReady ? 'cursor-pointer' : 'cursor-default'
                        } ${
                          isMenuOpen
                            ? 'border-blue-400/60 shadow-[0_0_0_1px_rgba(96,165,250,0.35),0_16px_36px_rgba(15,23,42,0.38)]'
                            : isReady
                              ? 'border-zinc-800 hover:border-blue-400/45 hover:shadow-[0_0_0_1px_rgba(96,165,250,0.22),0_12px_28px_rgba(15,23,42,0.28)]'
                              : 'border-zinc-800'
                        }`}
                      >
                        {cardBody}
                      </div>
                    );
                  })}
                  </div>
                  <PaginationControls page={projectPage} totalPages={totalProjectPages} onPageChange={setProjectPage} />
                </div>
              )}
            </CardContent>
          </Card>
      ) : (
        <Card id="assets-section" className="border-zinc-800 bg-transparent shadow-none">
          <CardHeader className="flex-col items-start gap-3 pb-0">
            <div>
              <CardTitle className="text-3xl font-semibold tracking-tight text-zinc-100">My Assets</CardTitle>
              <CardDescription className="mt-2 text-sm text-zinc-400">
                Your uploaded media, product info history, and reusable materials.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-6 px-0">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex flex-1 flex-col gap-6 lg:flex-row lg:items-center">
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
                <Button asChild variant="outline" className="rounded-2xl border-zinc-700 bg-zinc-900 text-zinc-100 hover:border-zinc-600 hover:bg-zinc-800">
                  <Link href="/create">
                    <Plus className="mr-2 h-4 w-4" />
                    Create Task
                  </Link>
                </Button>
              </div>
            </div>

            {groupedAssetProjects.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-zinc-800 px-4 py-10 text-sm text-zinc-500">
                No assets found for this filter.
              </div>
            ) : (
              <>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {paginatedAssetGroups.map((group, index) => {
                  const previewTone = getProjectCardTone(index);
                  const images = group.assets.filter((asset) => asset.type === 'image' || asset.mimeType.startsWith('image'));
                  const videosInGroup = group.assets.filter((asset) => asset.type === 'video' || asset.type === 'hook' || asset.mimeType.startsWith('video'));
                  const hooks = group.assets.filter((asset) => asset.type === 'hook');
                  const previewAssets = group.assets.slice(0, 4);
                  const canOpenProject = group.id !== 'unassigned';

                  return (
                    <Link
                      key={group.id}
                      href={canOpenProject ? `/assets/${group.id}` : '/workspace/assets'}
                      className="group relative w-full min-w-0 overflow-hidden rounded-[24px] border border-zinc-800 bg-zinc-900/80 transition-all hover:border-blue-400/45 hover:shadow-[0_0_0_1px_rgba(96,165,250,0.22),0_12px_28px_rgba(15,23,42,0.28)]"
                    >
                      <div className={`relative h-44 border-b border-zinc-800 bg-gradient-to-br ${previewTone}`}>
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.12),transparent_45%)]" />
                        <div className="absolute right-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-lg bg-black/45 px-2 py-1 text-[11px] font-semibold text-zinc-100 backdrop-blur">
                          <Grid2X2 className="h-3.5 w-3.5" />
                          {group.assets.length} asset{group.assets.length === 1 ? '' : 's'}
                        </div>
                          <div className="absolute inset-0 grid grid-cols-2 gap-1 p-3">
                          {previewAssets.map((assetPreview) => {
                            const isVideoAsset = assetPreview.type === 'video' || assetPreview.type === 'hook' || assetPreview.mimeType.startsWith('video');
                            return (
                              <div
                                key={assetPreview.id}
                                className="overflow-hidden rounded-xl border border-white/10 bg-black/20 backdrop-blur-sm"
                              >
                                <MediaThumbnail
                                  kind={isVideoAsset ? 'video' : 'image'}
                                  src={isVideoAsset ? assetPreview.storageUrl : (assetPreview.thumbnailUrl || assetPreview.storageUrl)}
                                  poster={isVideoAsset ? assetPreview.thumbnailUrl : null}
                                  alt={assetPreview.filename}
                                  className="h-full w-full object-cover"
                                  iconClassName="h-6 w-6 text-zinc-200/75"
                                />
                              </div>
                            );
                          })}
                          {previewAssets.length === 0 ? (
                            <div className="col-span-2 flex items-center justify-center rounded-xl border border-white/10 bg-black/20 backdrop-blur-sm">
                              <Grid2X2 className="h-7 w-7 text-zinc-200/70" />
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <div className="space-y-3 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-base font-semibold text-zinc-100">{group.name}</div>
                            <div className="mt-1 text-xs text-zinc-500">
                              {formatProjectDate(group.updatedAt)}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-3 border-t border-zinc-800 pt-3 text-xs text-zinc-500">
                          <span className="inline-flex items-center gap-1.5">
                            <ImageIcon className="h-4 w-4" />
                            <span>{images.length}</span>
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <Video className="h-4 w-4" />
                            <span>{videosInGroup.length}</span>
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <Film className="h-4 w-4" />
                            <span>{hooks.length}</span>
                          </span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
              <PaginationControls page={assetPage} totalPages={totalAssetPages} onPageChange={setAssetPage} />
              </>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={!!projectToDelete} onOpenChange={(open) => !open && setProjectToDelete(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader className="flex-col items-start gap-1 text-left">
            <DialogTitle>Delete project?</DialogTitle>
            <DialogDescription>
              This will remove the task and its generated outputs from your workspace. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-amber-100">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
            <p className="text-sm leading-5">
              Any tokens or generation credits already spent on this task will not be restored.
            </p>
          </div>
          <div className="mt-4 flex gap-2 sm:justify-end">
            <Button variant="outline" onClick={() => setProjectToDelete(null)} disabled={!!deletingProjectId}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => projectToDelete && void handleDeleteProject(projectToDelete.id)}
              disabled={!!deletingProjectId}
            >
              {deletingProjectId ? 'Deleting...' : 'Delete project'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
