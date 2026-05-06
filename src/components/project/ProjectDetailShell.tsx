"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Download,
  Film,
  Loader2,
  PencilLine,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Api } from '@/lib/api-client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ProjectAssetsSection } from './ProjectAssetsSection';

type ProjectDetail = {
  id: string;
  title: string;
  name: string;
  productName: string;
  productDescription: string;
  sellingPoints: string;
  targetAudience: string;
  promoEnabled: boolean;
  promoInfo: {
    originalPrice: string;
    salePrice: string;
    discountLabel: string;
  };
  renderOptions?: {
    captionsEnabled: boolean;
    backgroundMusicEnabled: boolean;
    stylePreset: 'balanced' | 'punchy' | 'calm';
    useHookClip: boolean;
    animateImages: boolean;
    shuffleVideoSlices: boolean;
  };
  publishQueue?: Array<{
    id: string;
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
    updatedAt: string;
  }>;
  selectedAssetIds: string[];
  hookAssetId: string | null;
  durationSeconds: number;
  aspectRatio: string;
  language: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  counts: {
    assets: number;
    uploadedAssets?: number;
    scripts: number;
    videoJobs: number;
    videos: number;
  };
  scripts: Array<{
    id: string;
    styleLabel: string;
    hookText: string;
    bodyText: string;
    ctaText: string;
    isSelected: boolean;
    sortOrder: number;
    createdAt: string;
  }>;
  videoJobs: Array<{
    id: string;
    scriptId: string;
    variantIndex: number;
    status: string;
    retryCount: number;
    errorMessage: string | null;
    voiceoverUrl: string | null;
    ttsTimestampsUrl: string | null;
    finalUrl: string | null;
    styleLabel: string;
    sortOrder: number;
    createdAt: string;
    startedAt: string | null;
    completedAt: string | null;
  }>;
  videos: Array<{
    id: string;
    storageUrl: string;
    thumbnailUrl: string | null;
    variantLabel: string | null;
    durationSeconds: number;
    fileSizeBytes: string;
    downloadCount: number;
    expiresAt: string;
    createdAt: string;
  }>;
};

function statusVariant(status: string) {
  if (status === 'completed' || status === 'done') return 'success';
  if (status === 'failed' || status === 'error') return 'danger';
  if (status === 'draft' || status === 'pending') return 'info';
  return 'default';
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1">
      <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="text-sm text-zinc-100">{value}</div>
    </div>
  );
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

function getTimeUntilExpiry(expiresAt: string) {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (!Number.isFinite(diff)) return null;
  if (diff <= 0) return 'Expired';
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 24) return `${hours}h left`;
  const days = Math.floor(hours / 24);
  return `${days}d left`;
}

function formatProjectDate(value?: string | null) {
  if (!value) return 'Pending';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Pending';
  const month = new Intl.DateTimeFormat('en-US', { month: 'short' }).format(date);
  const day = date.getDate();
  const year = date.getFullYear();
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const period = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${month} ${day},${year},${hours}:${minutes}${period}`;
}

function toLocalDateTimeInputValue(value?: string | null) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return '';

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function ProjectDetailShell({ projectId }: { projectId: string }) {
  const showLegacyProjectSections = false;
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [activeVideoIndex, setActiveVideoIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [generatingScripts, setGeneratingScripts] = useState(false);
  const [creatingVideoJobs, setCreatingVideoJobs] = useState(false);
  const [processingVideoJobs, setProcessingVideoJobs] = useState(false);
  const [savingScriptId, setSavingScriptId] = useState<string | null>(null);
  const [savingRenderOptions, setSavingRenderOptions] = useState(false);
  const [savingPromoInfo, setSavingPromoInfo] = useState(false);
  const [savingPublishQueue, setSavingPublishQueue] = useState(false);
  const [publishingItemId, setPublishingItemId] = useState<string | null>(null);
  const [channels, setChannels] = useState<Array<{
    id: string;
    platform: 'tiktok' | 'instagram_reels' | 'youtube_shorts';
    displayName: string;
    handle: string | null;
    status: 'connected' | 'disconnected';
  }>>([]);
  const [draftScripts, setDraftScripts] = useState<Record<string, {
    styleLabel: string;
    hookText: string;
    bodyText: string;
    ctaText: string;
    isSelected: boolean;
  }>>({});
  const [draftRenderOptions, setDraftRenderOptions] = useState({
    captionsEnabled: true,
    backgroundMusicEnabled: true,
    stylePreset: 'balanced' as 'balanced' | 'punchy' | 'calm',
    useHookClip: true,
    animateImages: true,
    shuffleVideoSlices: true,
  });
  const [draftPromo, setDraftPromo] = useState({
    promoEnabled: false,
    originalPrice: '',
    salePrice: '',
    discountLabel: '',
  });
  const [draftPublish, setDraftPublish] = useState({
    videoId: '',
    platform: 'tiktok' as 'tiktok' | 'instagram_reels' | 'youtube_shorts',
    channelId: '' as string,
    title: '',
    description: '',
    publishAt: toLocalDateTimeInputValue(),
    status: 'draft' as 'draft' | 'scheduled',
  });
  const [editingPublishId, setEditingPublishId] = useState<string | null>(null);
  const [deletingProject, setDeletingProject] = useState(false);

  useEffect(() => {
    setDraftPublish((current) => {
      if (current.publishAt) return current;
      return {
        ...current,
        publishAt: toLocalDateTimeInputValue(),
      };
    });
  }, []);

  async function loadProject(signal?: { cancelled: boolean }) {
    try {
      const [projectResult, channelsResult] = await Promise.all([Api.getProject(projectId), Api.getChannels()]);
      const result = projectResult;
      if (signal?.cancelled) return;
      setProject(result as ProjectDetail);
      setChannels(
        (Array.isArray(channelsResult) ? channelsResult : []).map((channel: any) => ({
          id: channel.id,
          platform: channel.platform,
          displayName: channel.displayName,
          handle: channel.handle,
          status: channel.status,
        })),
      );
      const nextDrafts = Object.fromEntries(
        ((result as ProjectDetail).scripts || []).map((script) => [
          script.id,
          {
            styleLabel: script.styleLabel,
            hookText: script.hookText,
            bodyText: script.bodyText,
            ctaText: script.ctaText,
            isSelected: script.isSelected,
          },
        ]),
      );
      setDraftScripts(nextDrafts);
      setDraftRenderOptions({
        captionsEnabled: (result as ProjectDetail).renderOptions?.captionsEnabled !== false,
        backgroundMusicEnabled: (result as ProjectDetail).renderOptions?.backgroundMusicEnabled !== false,
        stylePreset: (result as ProjectDetail).renderOptions?.stylePreset ?? 'balanced',
        useHookClip: (result as ProjectDetail).renderOptions?.useHookClip !== false,
        animateImages: (result as ProjectDetail).renderOptions?.animateImages !== false,
        shuffleVideoSlices: (result as ProjectDetail).renderOptions?.shuffleVideoSlices !== false,
      });
      setDraftPromo({
        promoEnabled: (result as ProjectDetail).promoEnabled === true,
        originalPrice: (result as ProjectDetail).promoInfo?.originalPrice ?? '',
        salePrice: (result as ProjectDetail).promoInfo?.salePrice ?? '',
        discountLabel: (result as ProjectDetail).promoInfo?.discountLabel ?? '',
      });
      const publishQueue = (result as ProjectDetail).publishQueue ?? [];
      setDraftPublish((current) => {
        if (editingPublishId) {
          return current;
        }
        return {
          videoId: current.videoId || ((result as ProjectDetail).videos[0]?.id ?? ''),
          platform: current.platform || 'tiktok',
          channelId: current.channelId || '',
          title: '',
          description: '',
          publishAt: toLocalDateTimeInputValue(),
          status: 'draft',
        };
      });
      setLoadError(null);
    } catch (err: any) {
      if (signal?.cancelled) return;
      setLoadError(err?.error?.message || 'Failed to load project');
    } finally {
      if (!signal?.cancelled) setLoading(false);
    }
  }

  async function handleGenerateScripts() {
    setGeneratingScripts(true);
    try {
      await Api.generateProjectScripts(projectId, { overwrite: true });
      toast.success('Scripts generated');
      await loadProject();
    } catch (err: any) {
      toast.error(err?.error?.message || 'Failed to generate scripts');
    } finally {
      setGeneratingScripts(false);
    }
  }

  async function handleCreateVideoJobs() {
    setCreatingVideoJobs(true);
    try {
      await Api.createVideoJobs(projectId, { overwrite: true });
      toast.success('Video jobs created');
      await loadProject();
    } catch (err: any) {
      toast.error(err?.error?.message || 'Failed to create video jobs');
    } finally {
      setCreatingVideoJobs(false);
    }
  }

  async function handleProcessVideoJobs() {
    setProcessingVideoJobs(true);
    try {
      await Api.processVideoJobs(projectId);
      toast.success('Started processing the next pending video job');
      await loadProject();
    } catch (err: any) {
      toast.error(err?.error?.message || 'Failed to process the next video job');
    } finally {
      setProcessingVideoJobs(false);
    }
  }

  function jobBadgeVariant(status: string) {
    if (status === 'done') return 'success';
    if (status === 'failed') return 'danger';
    if (status === 'pending' || status === 'processing') return 'info';
    return 'default';
  }

  function publishBadgeVariant(status: string) {
    if (status === 'published') return 'success';
    if (status === 'failed') return 'danger';
    if (status === 'ready') return 'info';
    if (status === 'scheduled') return 'default';
    return 'default';
  }

  function updateDraftScript(
    scriptId: string,
    patch: Partial<{
      styleLabel: string;
      hookText: string;
      bodyText: string;
      ctaText: string;
      isSelected: boolean;
    }>,
  ) {
    setDraftScripts((current) => ({
      ...current,
      [scriptId]: {
        ...(current[scriptId] || {
          styleLabel: '',
          hookText: '',
          bodyText: '',
          ctaText: '',
          isSelected: true,
        }),
        ...patch,
      },
    }));
  }

  async function handleSaveScript(scriptId: string) {
    const draft = draftScripts[scriptId];
    if (!draft) return;

    setSavingScriptId(scriptId);
    try {
      await Api.updateProjectScript(projectId, scriptId, draft);
      toast.success('Script saved');
      await loadProject();
    } catch (err: any) {
      toast.error(err?.error?.message || 'Failed to update script');
    } finally {
      setSavingScriptId(null);
    }
  }

  async function handleSaveRenderOptions() {
    setSavingRenderOptions(true);
    try {
      await Api.updateProject(projectId, { renderOptions: draftRenderOptions });
      toast.success('Render options saved');
      await loadProject();
    } catch (err: any) {
      toast.error(err?.error?.message || 'Failed to update render options');
    } finally {
      setSavingRenderOptions(false);
    }
  }

  async function handleSavePromoInfo() {
    setSavingPromoInfo(true);
    try {
      await Api.updateProject(projectId, {
        promoEnabled: draftPromo.promoEnabled,
        promoInfo: {
          originalPrice: draftPromo.originalPrice,
          salePrice: draftPromo.salePrice,
          discountLabel: draftPromo.discountLabel,
        },
      });
      toast.success('Promotion settings saved');
      await loadProject();
    } catch (err: any) {
      toast.error(err?.error?.message || 'Failed to update promotion settings');
    } finally {
      setSavingPromoInfo(false);
    }
  }

  async function handleSavePublishQueue() {
    if (!project) return;
    if (!draftPublish.videoId) {
      toast.error('Select a generated video first');
      return;
    }
    if (!draftPublish.title.trim()) {
      toast.error('Publish title is required');
      return;
    }
    if (!draftPublish.publishAt) {
      toast.error('Publish time is required');
      return;
    }

    setSavingPublishQueue(true);
    try {
      const existingQueue = project.publishQueue ?? [];
      const existingItem = existingQueue.find((item) => item.id === editingPublishId);
      const nowIso = new Date().toISOString();
      const queueEntry = {
        id: editingPublishId ?? crypto.randomUUID(),
        videoId: draftPublish.videoId,
        platform: draftPublish.platform,
        channelId: draftPublish.channelId || null,
        title: draftPublish.title.trim(),
        description: draftPublish.description.trim(),
        publishAt: new Date(draftPublish.publishAt).toISOString(),
        status: draftPublish.status,
        publishedAt: existingItem?.publishedAt ?? null,
        providerPostId: existingItem?.providerPostId ?? null,
        publishedUrl: existingItem?.publishedUrl ?? null,
        lastAttemptAt: existingItem?.lastAttemptAt ?? null,
        errorMessage: null,
        createdAt: existingItem?.createdAt ?? nowIso,
        updatedAt: nowIso,
      };
      const nextQueue = editingPublishId
        ? existingQueue.map((item) => (item.id === editingPublishId ? queueEntry : item))
        : [queueEntry, ...existingQueue].slice(0, 50);
      await Api.updateProject(projectId, {
        publishQueue: nextQueue,
      });
      toast.success(
        editingPublishId
          ? 'Publish task updated'
          : draftPublish.status === 'scheduled'
            ? 'Publish task scheduled'
            : 'Publish draft saved',
      );
      setEditingPublishId(null);
      setDraftPublish({
        videoId: project.videos[0]?.id ?? '',
        platform: 'tiktok',
        channelId: '',
        title: '',
        description: '',
        publishAt: toLocalDateTimeInputValue(),
        status: 'draft',
      });
      await loadProject();
    } catch (err: any) {
      toast.error(err?.error?.message || 'Failed to save publish task');
    } finally {
      setSavingPublishQueue(false);
    }
  }

  function handleEditPublishItem(item: NonNullable<ProjectDetail['publishQueue']>[number]) {
    setEditingPublishId(item.id);
    setDraftPublish({
      videoId: item.videoId,
      platform: item.platform,
      channelId: item.channelId ?? '',
      title: item.title,
      description: item.description,
      publishAt: toLocalDateTimeInputValue(item.publishAt),
      status: item.status === 'scheduled' ? 'scheduled' : 'draft',
    });
  }

  async function handlePublishNow(itemId: string) {
    setPublishingItemId(itemId);
    try {
      await Api.publishProjectQueueItem(projectId, itemId);
      toast.success('Publish task marked as published');
      await loadProject();
    } catch (err: any) {
      toast.error(err?.error?.message || 'Failed to publish task');
      await loadProject();
    } finally {
      setPublishingItemId(null);
    }
  }

  async function handleDeletePublishItem(itemId: string) {
    if (!project) return;
    setSavingPublishQueue(true);
    try {
      const nextQueue = (project.publishQueue ?? []).filter((item) => item.id !== itemId);
      await Api.updateProject(projectId, { publishQueue: nextQueue });
      if (editingPublishId === itemId) {
        setEditingPublishId(null);
        setDraftPublish({
          videoId: project.videos[0]?.id ?? '',
          platform: 'tiktok',
          channelId: '',
          title: '',
          description: '',
          publishAt: toLocalDateTimeInputValue(),
          status: 'draft',
        });
      }
      toast.success('Publish task deleted');
      await loadProject();
    } catch (err: any) {
      toast.error(err?.error?.message || 'Failed to delete publish task');
    } finally {
      setSavingPublishQueue(false);
    }
  }

  useEffect(() => {
    const signal = { cancelled: false };
    loadProject(signal);
    return () => {
      signal.cancelled = true;
    };
  }, [projectId]);

  useEffect(() => {
    if (!project) return;
    setActiveVideoIndex((current) => {
      if (project.videos.length === 0) return 0;
      return Math.min(current, project.videos.length - 1);
    });
  }, [project]);

  if (loading) {
    return <div className="mx-auto w-full max-w-6xl px-4 py-6 text-sm text-zinc-500">Loading project...</div>;
  }

  if (loadError || !project) {
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6">
        <div className="text-sm text-rose-300">{loadError || 'Project not found'}</div>
        <div>
          <Button asChild variant="outline">
            <Link href="/workspace">Back to Workspace</Link>
          </Button>
        </div>
      </div>
    );
  }

  const activeVideo = project.videos[activeVideoIndex] ?? null;
  const activeExpiryLabel = activeVideo ? getTimeUntilExpiry(activeVideo.expiresAt) : null;
  const canMovePrev = activeVideoIndex > 0;
  const canMoveNext = activeVideoIndex < project.videos.length - 1;

  async function handleDeleteProject() {
    if (deletingProject) return;
    const confirmed = typeof window === 'undefined'
      ? true
      : window.confirm('Delete this project? This action cannot be undone.');
    if (!confirmed) return;

    setDeletingProject(true);
    try {
      await Api.deleteProject(project.id);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('project:deleted', { detail: { projectId: project.id } }));
      }
      toast.success('Project deleted');
      router.push('/workspace/projects');
    } catch (err: any) {
      toast.error(err?.error?.message || 'Could not delete the project. Please try again.');
      setDeletingProject(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex items-center">
        <Button asChild variant="ghost" className="h-10 max-w-full rounded-2xl px-3 text-zinc-300 hover:bg-zinc-900 hover:text-zinc-100">
          <Link href="/workspace/projects" className="min-w-0">
            <ArrowLeft className="mr-2 h-4 w-4 shrink-0" />
            <span className="truncate">{project.title}</span>
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_360px]">
        <Card className="overflow-hidden rounded-[32px] border-zinc-800 bg-zinc-900/75 text-zinc-100">
          <CardContent className="p-0">
            <div className="relative flex min-h-[560px] items-center justify-center bg-[radial-gradient(circle_at_top,rgba(139,92,246,0.24),transparent_32%),linear-gradient(180deg,rgba(24,24,27,0.98),rgba(9,9,11,0.98))] p-6">
              <button
                type="button"
                onClick={() => setActiveVideoIndex((current) => Math.max(0, current - 1))}
                disabled={!canMovePrev}
                className="absolute left-4 top-1/2 z-10 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-2xl border border-zinc-700 bg-black/35 text-zinc-100 backdrop-blur transition hover:border-zinc-600 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Previous variant"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => setActiveVideoIndex((current) => Math.min(project.videos.length - 1, current + 1))}
                disabled={!canMoveNext}
                className="absolute right-4 top-1/2 z-10 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-2xl border border-zinc-700 bg-black/35 text-zinc-100 backdrop-blur transition hover:border-zinc-600 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Next variant"
              >
                <ChevronRight className="h-5 w-5" />
              </button>

              <div className="absolute left-5 top-5 inline-flex items-center gap-2 rounded-full border border-zinc-700 bg-black/35 px-3 py-1.5 text-xs font-medium text-zinc-100 backdrop-blur">
                <Film className="h-3.5 w-3.5" />
                {activeVideo ? `${activeVideoIndex + 1} / ${project.videos.length}` : 'No variants yet'}
              </div>

              {activeVideo ? (
                <div className="relative aspect-[9/16] w-full max-w-[360px] overflow-hidden rounded-[28px] border border-zinc-700 bg-black shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
                  {activeVideo.storageUrl ? (
                    <video
                      key={activeVideo.id}
                      src={activeVideo.storageUrl}
                      poster={activeVideo.thumbnailUrl || undefined}
                      controls
                      playsInline
                      preload="metadata"
                      className="h-full w-full bg-black object-contain"
                    />
                  ) : activeVideo.thumbnailUrl ? (
                    <img
                      src={activeVideo.thumbnailUrl}
                      alt={activeVideo.variantLabel || 'Video variant preview'}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-violet-950 via-indigo-950 to-zinc-950">
                      <div className="text-center">
                        <Film className="mx-auto h-10 w-10 text-zinc-300" />
                        <div className="mt-3 text-sm font-medium text-zinc-200">
                          {activeVideo.variantLabel || `Variant ${activeVideoIndex + 1}`}
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent p-4">
                    <div className="text-sm font-medium text-zinc-100">
                      {activeVideo.variantLabel || `Variant ${activeVideoIndex + 1}`}
                    </div>
                    <div className="mt-1 text-xs text-zinc-300">
                      {formatDurationShort(activeVideo.durationSeconds)} • {formatBytes(activeVideo.fileSizeBytes)}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex aspect-[9/16] w-full max-w-[360px] items-center justify-center rounded-[28px] border border-dashed border-zinc-700 bg-zinc-950/80">
                  <div className="text-center text-zinc-400">
                    <Film className="mx-auto h-10 w-10" />
                    <div className="mt-3 text-sm">No generated videos yet</div>
                  </div>
                </div>
              )}
            </div>

          </CardContent>
        </Card>

        <Card className="rounded-[32px] border-zinc-800 bg-zinc-900/75 text-zinc-100">
          <CardContent className="space-y-6 p-6">
            <div className="grid gap-3 sm:grid-cols-2">
              <Button
                asChild
                variant="outline"
                className="h-11 rounded-2xl border-zinc-700 bg-zinc-950 text-zinc-100 hover:border-zinc-600 hover:bg-zinc-900"
              >
                <a href={activeVideo ? `/api/videos/${activeVideo.id}/download` : '#'} aria-disabled={!activeVideo}>
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </a>
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-2xl border-zinc-700 bg-zinc-950 text-zinc-100 hover:border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-100"
                onClick={() => void handleDeleteProject()}
                disabled={deletingProject}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {deletingProject ? 'Deleting...' : 'Delete'}
              </Button>
            </div>

            <Button
              type="button"
              variant="outline"
              className="h-auto w-full rounded-3xl border-zinc-700 bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-950 px-5 py-4 text-left text-zinc-100 hover:border-violet-400/30 hover:bg-zinc-900"
            >
              <div className="flex w-full items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-zinc-100">Remove watermark</div>
                  <div className="mt-1 text-xs text-zinc-400">Upgrade to get clean exports</div>
                </div>
                <span className="shrink-0 rounded-full border border-violet-400/30 bg-violet-500/10 px-2.5 py-1 text-[11px] font-medium text-violet-200">
                  Upgrade
                </span>
              </div>
            </Button>

            <div className="space-y-4 rounded-3xl border border-zinc-800 bg-zinc-950/80 p-5">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">Variant Info</div>
                <div className="mt-2 text-sm font-medium text-zinc-100">
                  {activeVideo?.variantLabel || `Variant ${activeVideoIndex + 1}`}
                </div>
              </div>

              <div className="grid gap-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-zinc-500">Created</span>
                  <span className="text-zinc-100">
                    {formatProjectDate(activeVideo?.createdAt)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-zinc-500">Expires</span>
                  <span className={activeExpiryLabel === 'Expired' ? 'text-rose-300' : 'text-zinc-100'}>
                    {activeVideo ? formatProjectDate(activeVideo.expiresAt) : 'Pending'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-zinc-500">File Size</span>
                  <span className="text-zinc-100">{activeVideo ? formatBytes(activeVideo.fileSizeBytes) : 'Pending'}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-zinc-500">Downloads</span>
                  <span className="text-zinc-100">{activeVideo?.downloadCount ?? 0}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {showLegacyProjectSections ? (
      <>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
        <Card className="border-zinc-800 bg-zinc-900/70 text-zinc-100">
          <CardHeader className="flex-col items-start gap-1">
            <CardTitle>Project Brief</CardTitle>
            <CardDescription className="text-zinc-400">Core fields saved from the create-project step.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5">
            <InfoRow label="Product Name" value={project.productName} />
            <InfoRow label="Product Description" value={project.productDescription} />
            <InfoRow label="Selling Points" value={project.sellingPoints} />
            <InfoRow label="Target Audience" value={project.targetAudience} />
          </CardContent>
        </Card>

        <div className="grid gap-6">
          <Card className="border-zinc-800 bg-zinc-900/70 text-zinc-100">
            <CardHeader className="flex-col items-start gap-1">
              <CardTitle>Settings</CardTitle>
              <CardDescription className="text-zinc-400">Stored generation parameters.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <InfoRow label="Duration" value={`${project.durationSeconds} seconds`} />
              <InfoRow label="Language" value={project.language} />
              <InfoRow label="Aspect Ratio" value={project.aspectRatio} />
              <InfoRow label="Promo" value={project.promoEnabled ? 'Enabled' : 'Disabled'} />
            </CardContent>
          </Card>

          <Card className="border-zinc-800 bg-zinc-900/70 text-zinc-100">
            <CardHeader className="flex-col items-start gap-1">
              <CardTitle>Render Options</CardTitle>
              <CardDescription className="text-zinc-400">Control subtitles, background music, and render pacing for the next video.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <div className="text-sm font-medium text-zinc-100">Style Preset</div>
                <Select
                  value={draftRenderOptions.stylePreset}
                  onValueChange={(value: 'balanced' | 'punchy' | 'calm') =>
                    setDraftRenderOptions((prev) => ({ ...prev, stylePreset: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select style preset" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="balanced">Balanced</SelectItem>
                    <SelectItem value="punchy">Punchy</SelectItem>
                    <SelectItem value="calm">Calm</SelectItem>
                  </SelectContent>
                </Select>
                <div className="text-xs text-zinc-500">
                  Balanced keeps the current default. Punchy cuts faster. Calm holds shots longer with slightly softer audio.
                </div>
              </div>
              <label className="flex items-center gap-3 text-sm text-zinc-100">
                <Checkbox
                  checked={draftRenderOptions.captionsEnabled}
                  onCheckedChange={(checked) =>
                    setDraftRenderOptions((prev) => ({ ...prev, captionsEnabled: checked === true }))
                  }
                />
                <span>Burn subtitles into output videos</span>
              </label>
              <label className="flex items-center gap-3 text-sm text-zinc-100">
                <Checkbox
                  checked={draftRenderOptions.backgroundMusicEnabled}
                  onCheckedChange={(checked) =>
                    setDraftRenderOptions((prev) => ({ ...prev, backgroundMusicEnabled: checked === true }))
                  }
                />
                <span>Include background music</span>
              </label>
              <label className="flex items-center gap-3 text-sm text-zinc-100">
                <Checkbox
                  checked={draftRenderOptions.useHookClip}
                  onCheckedChange={(checked) =>
                    setDraftRenderOptions((prev) => ({ ...prev, useHookClip: checked === true }))
                  }
                />
                <span>Use hook clip at the start</span>
              </label>
              <label className="flex items-center gap-3 text-sm text-zinc-100">
                <Checkbox
                  checked={draftRenderOptions.animateImages}
                  onCheckedChange={(checked) =>
                    setDraftRenderOptions((prev) => ({ ...prev, animateImages: checked === true }))
                  }
                />
                <span>Animate image segments</span>
              </label>
              <label className="flex items-center gap-3 text-sm text-zinc-100">
                <Checkbox
                  checked={draftRenderOptions.shuffleVideoSlices}
                  onCheckedChange={(checked) =>
                    setDraftRenderOptions((prev) => ({ ...prev, shuffleVideoSlices: checked === true }))
                  }
                />
                <span>Shuffle sliced video segments</span>
              </label>
              <div>
                <Button type="button" variant="outline" onClick={handleSaveRenderOptions} disabled={savingRenderOptions}>
                  {savingRenderOptions ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Save Render Options
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-zinc-800 bg-zinc-900/70 text-zinc-100">
            <CardHeader className="flex-col items-start gap-1">
              <CardTitle>Promotion</CardTitle>
              <CardDescription className="text-zinc-400">Optional pricing context used during script generation.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <label className="flex items-center gap-3 text-sm text-zinc-100">
                <Checkbox
                  checked={draftPromo.promoEnabled}
                  onCheckedChange={(checked) =>
                    setDraftPromo((prev) => ({ ...prev, promoEnabled: checked === true }))
                  }
                />
                <span>Include promotion details in generated scripts</span>
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <div className="text-sm font-medium text-zinc-100">Original Price</div>
                  <Input
                    value={draftPromo.originalPrice}
                    onChange={(event) => setDraftPromo((prev) => ({ ...prev, originalPrice: event.target.value }))}
                    placeholder="$79"
                    disabled={!draftPromo.promoEnabled}
                    maxLength={80}
                  />
                </div>
                <div className="grid gap-2">
                  <div className="text-sm font-medium text-zinc-100">Sale Price</div>
                  <Input
                    value={draftPromo.salePrice}
                    onChange={(event) => setDraftPromo((prev) => ({ ...prev, salePrice: event.target.value }))}
                    placeholder="$49"
                    disabled={!draftPromo.promoEnabled}
                    maxLength={80}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <div className="text-sm font-medium text-zinc-100">Offer Details</div>
                <Textarea
                  value={draftPromo.discountLabel}
                  onChange={(event) => setDraftPromo((prev) => ({ ...prev, discountLabel: event.target.value }))}
                  placeholder="Save 38% this week only"
                  disabled={!draftPromo.promoEnabled}
                  maxLength={160}
                  className="min-h-[84px]"
                />
              </div>
              <div>
                <Button type="button" variant="outline" onClick={handleSavePromoInfo} disabled={savingPromoInfo}>
                  {savingPromoInfo ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Save Promotion
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-zinc-800 bg-zinc-900/70 text-zinc-100">
            <CardHeader className="flex-col items-start gap-1">
              <CardTitle>Pipeline Summary</CardTitle>
              <CardDescription className="text-zinc-400">Current attached records for this project.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <InfoRow label="Selected Assets" value={String(project.counts.assets)} />
              <InfoRow label="Uploaded Assets" value={String(project.counts.uploadedAssets ?? project.counts.assets)} />
              <InfoRow label="Scripts" value={String(project.counts.scripts)} />
              <InfoRow label="Video Jobs" value={String(project.counts.videoJobs)} />
              <InfoRow label="Videos" value={String(project.counts.videos)} />
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ProjectAssetsSection
          projectId={projectId}
          selectedAssetIds={project.selectedAssetIds}
          hookAssetId={project.hookAssetId}
          onChanged={() => loadProject()}
        />

        <Card className="border-zinc-800 bg-zinc-900/70 text-zinc-100">
          <CardHeader className="flex-col items-start gap-1">
            <div className="flex w-full items-center justify-between gap-3">
              <CardTitle>Scripts</CardTitle>
              <Button type="button" size="sm" onClick={handleGenerateScripts} disabled={generatingScripts}>
                {generatingScripts ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {project.scripts.length > 0 ? 'Regenerate Scripts' : 'Generate Scripts'}
              </Button>
            </div>
            <CardDescription className="text-zinc-400">{project.scripts.length === 0 ? 'No scripts generated yet.' : `${project.scripts.length} script variants saved.`}</CardDescription>
          </CardHeader>
          <CardContent>
            {project.scripts.length === 0 ? (
              <div className="rounded-lg border border-dashed border-zinc-800 px-4 py-6 text-sm text-zinc-500">
                Script generation is not wired yet in this phase.
              </div>
            ) : (
              <div className="space-y-3">
                {project.scripts.map((script) => (
                  <div key={script.id} className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={draftScripts[script.id]?.isSelected ?? script.isSelected}
                          onCheckedChange={(checked) => updateDraftScript(script.id, { isSelected: checked === true })}
                        />
                        <Badge variant={(draftScripts[script.id]?.isSelected ?? script.isSelected) ? 'success' : 'default'}>
                          {(draftScripts[script.id]?.isSelected ?? script.isSelected) ? 'selected' : 'inactive'}
                        </Badge>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleSaveScript(script.id)}
                        disabled={savingScriptId === script.id}
                      >
                        {savingScriptId === script.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Save Script
                      </Button>
                    </div>
                    <div className="mt-3 grid gap-3">
                      <Input
                        value={draftScripts[script.id]?.styleLabel ?? script.styleLabel}
                        onChange={(event) => updateDraftScript(script.id, { styleLabel: event.target.value })}
                        placeholder={`Variant ${script.sortOrder}`}
                      />
                      <Textarea
                        value={draftScripts[script.id]?.hookText ?? script.hookText}
                        onChange={(event) => updateDraftScript(script.id, { hookText: event.target.value })}
                        className="min-h-[90px]"
                      />
                      <Textarea
                        value={draftScripts[script.id]?.bodyText ?? script.bodyText}
                        onChange={(event) => updateDraftScript(script.id, { bodyText: event.target.value })}
                        className="min-h-[130px]"
                      />
                      <Textarea
                        value={draftScripts[script.id]?.ctaText ?? script.ctaText}
                        onChange={(event) => updateDraftScript(script.id, { ctaText: event.target.value })}
                        className="min-h-[80px]"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-zinc-800 bg-zinc-900/70 text-zinc-100">
          <CardHeader className="flex-col items-start gap-1">
            <div className="flex w-full items-center justify-between gap-3">
              <CardTitle>Video Jobs</CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleProcessVideoJobs}
                  disabled={processingVideoJobs || project.videoJobs.length === 0}
                >
                  {processingVideoJobs ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Process Next Job
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleCreateVideoJobs}
                  disabled={creatingVideoJobs || project.scripts.length === 0}
                >
                  {creatingVideoJobs ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {project.videoJobs.length > 0 ? 'Recreate Jobs' : 'Create Video Jobs'}
                </Button>
              </div>
            </div>
            <CardDescription className="text-zinc-400">
              {project.videoJobs.length === 0
                ? 'Create one pending job per selected script.'
                : `${project.videoJobs.length} pending jobs are ready for the worker.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {project.videoJobs.length === 0 ? (
              <div className="rounded-lg border border-dashed border-zinc-800 px-4 py-6 text-sm text-zinc-500">
                Video job creation is ready. The next step is to queue one job per selected script.
              </div>
            ) : (
              <div className="space-y-3">
                {project.videoJobs.map((job) => (
                  <div key={job.id} className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-medium text-zinc-100">
                        Variant {job.variantIndex}: {job.styleLabel || `Script ${job.sortOrder}`}
                      </div>
                      <Badge variant={jobBadgeVariant(job.status)}>{job.status}</Badge>
                    </div>
                    <div className="mt-2 text-xs text-zinc-500">
                      Created {new Date(job.createdAt).toLocaleString()}
                      {job.errorMessage ? ` • ${job.errorMessage}` : ''}
                    </div>
                    {(job.voiceoverUrl || job.ttsTimestampsUrl || job.finalUrl) ? (
                      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                        {job.voiceoverUrl ? (
                          <a href={job.voiceoverUrl} target="_blank" rel="noreferrer" className="text-blue-300 hover:underline">
                            Voiceover
                          </a>
                        ) : null}
                        {job.ttsTimestampsUrl ? (
                          <a href={job.ttsTimestampsUrl} target="_blank" rel="noreferrer" className="text-blue-300 hover:underline">
                            Timestamps
                          </a>
                        ) : null}
                        {job.finalUrl ? (
                          <a href={job.finalUrl} target="_blank" rel="noreferrer" className="text-blue-300 hover:underline">
                            Final Output
                          </a>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-zinc-800 bg-zinc-900/70 text-zinc-100">
          <CardHeader className="flex-col items-start gap-1">
            <CardTitle>Videos</CardTitle>
            <CardDescription className="text-zinc-400">{project.videos.length === 0 ? 'No output videos yet.' : `${project.videos.length} videos generated.`}</CardDescription>
          </CardHeader>
          <CardContent>
            {project.videos.length === 0 ? (
              <div className="rounded-lg border border-dashed border-zinc-800 px-4 py-6 text-sm text-zinc-500">
                Video generation is not wired yet in this phase.
              </div>
            ) : (
              <div className="space-y-3">
                {project.videos.map((video) => (
                  <div key={video.id} className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-4 py-3">
                    <div className="text-sm font-medium text-zinc-100">{video.variantLabel || 'Generated video'}</div>
                    <div className="mt-1 text-xs text-zinc-500">
                      {video.durationSeconds}s • {formatBytes(video.fileSizeBytes)} • {new Date(video.createdAt).toLocaleString()}
                    </div>
                    <div className="mt-1 text-xs text-zinc-500">
                      Downloads: {video.downloadCount} • Expires {new Date(video.expiresAt).toLocaleDateString()}
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <Button asChild size="sm" variant="outline">
                        <a href={`/api/videos/${video.id}/download`}>Download</a>
                      </Button>
                      <a
                        href={video.storageUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-blue-300 hover:underline"
                      >
                        Open source file
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-zinc-800 bg-zinc-900/70 text-zinc-100">
          <CardHeader className="flex-col items-start gap-1">
            <CardTitle>Publish Queue</CardTitle>
            <CardDescription className="text-zinc-400">Save a publish draft or schedule a future post for a generated video.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4">
              <div className="grid gap-2">
                <div className="text-sm font-medium text-zinc-100">Video</div>
                <Select
                  value={draftPublish.videoId}
                  onValueChange={(value) => setDraftPublish((prev) => ({ ...prev, videoId: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a generated video" />
                  </SelectTrigger>
                  <SelectContent>
                    {project.videos.map((video) => (
                      <SelectItem key={video.id} value={video.id}>
                        {video.variantLabel || 'Generated video'} • {video.durationSeconds}s
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <div className="text-sm font-medium text-zinc-100">Post Title</div>
                <Input
                  value={draftPublish.title}
                  onChange={(event) => setDraftPublish((prev) => ({ ...prev, title: event.target.value }))}
                  placeholder="Spring launch teaser"
                  maxLength={160}
                />
              </div>
              <div className="grid gap-2">
                <div className="text-sm font-medium text-zinc-100">Description</div>
                <Textarea
                  value={draftPublish.description}
                  onChange={(event) => setDraftPublish((prev) => ({ ...prev, description: event.target.value }))}
                  placeholder="Short caption or posting notes"
                  maxLength={2000}
                  className="min-h-[100px]"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <div className="text-sm font-medium text-zinc-100">Platform</div>
                  <Select
                    value={draftPublish.platform}
                    onValueChange={(value: 'tiktok' | 'instagram_reels' | 'youtube_shorts') =>
                      setDraftPublish((prev) => ({ ...prev, platform: value, channelId: '' }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select platform" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tiktok">TikTok</SelectItem>
                      <SelectItem value="instagram_reels">Instagram Reels</SelectItem>
                      <SelectItem value="youtube_shorts">YouTube Shorts</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <div className="text-sm font-medium text-zinc-100">Channel</div>
                  <Select
                    value={draftPublish.channelId || '__none__'}
                    onValueChange={(value) => setDraftPublish((prev) => ({ ...prev, channelId: value === '__none__' ? '' : value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select channel" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">No channel selected</SelectItem>
                      {channels
                        .filter((channel) => channel.platform === draftPublish.platform)
                        .map((channel) => (
                          <SelectItem key={channel.id} value={channel.id}>
                            {channel.displayName}{channel.handle ? ` (${channel.handle})` : ''}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <div className="text-sm font-medium text-zinc-100">Publish Time</div>
                  <Input
                    type="datetime-local"
                    value={draftPublish.publishAt}
                    onChange={(event) => setDraftPublish((prev) => ({ ...prev, publishAt: event.target.value }))}
                  />
                </div>
                <div className="grid gap-2">
                  <div className="text-sm font-medium text-zinc-100">Status</div>
                  <Select
                    value={draftPublish.status}
                    onValueChange={(value: 'draft' | 'scheduled') => setDraftPublish((prev) => ({ ...prev, status: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="scheduled">Scheduled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Button type="button" variant="outline" onClick={handleSavePublishQueue} disabled={savingPublishQueue || project.videos.length === 0}>
                  {savingPublishQueue ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {editingPublishId
                    ? 'Update Publish Task'
                    : draftPublish.status === 'scheduled'
                      ? 'Schedule Post'
                      : 'Save Draft'}
                </Button>
                {editingPublishId ? (
                  <Button
                    type="button"
                    variant="ghost"
                    className="ml-2"
                    onClick={() => {
                      setEditingPublishId(null);
                      setDraftPublish({
                        videoId: project.videos[0]?.id ?? '',
                        platform: 'tiktok',
                        channelId: '',
                        title: '',
                        description: '',
                        publishAt: toLocalDateTimeInputValue(),
                        status: 'draft',
                      });
                    }}
                  >
                    Cancel Edit
                  </Button>
                ) : null}
              </div>
            </div>
            <div className="space-y-3">
              {(project.publishQueue ?? []).length === 0 ? (
                <div className="rounded-lg border border-dashed border-zinc-800 px-4 py-6 text-sm text-zinc-500">
                  No publish drafts yet.
                </div>
              ) : (
                (project.publishQueue ?? []).map((item) => {
                  const linkedVideo = project.videos.find((video) => video.id === item.videoId);
                  const linkedChannel = channels.find((channel) => channel.id === item.channelId);
                  return (
                    <div key={item.id} className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-medium text-zinc-100">{item.title}</div>
                        <div className="flex items-center gap-2">
                          <Badge variant={publishBadgeVariant(item.status)}>{item.status}</Badge>
                          <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleEditPublishItem(item)} aria-label="Edit publish task">
                            <PencilLine className="h-4 w-4" />
                          </Button>
                          <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-red-600" onClick={() => handleDeletePublishItem(item.id)} aria-label="Delete publish task">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="mt-1 text-xs text-zinc-500">
                        {item.platform.replace(/_/g, ' ')} • {linkedVideo?.variantLabel || 'Generated video'} • {new Date(item.publishAt).toLocaleString()}
                      </div>
                      <div className="mt-1 text-xs text-zinc-500">
                        Channel: {linkedChannel ? `${linkedChannel.displayName}${linkedChannel.handle ? ` (${linkedChannel.handle})` : ''}` : 'Unassigned'}
                      </div>
                      {item.publishedAt ? (
                        <div className="mt-1 text-xs text-zinc-500">
                          Published at {new Date(item.publishedAt).toLocaleString()}
                        </div>
                      ) : null}
                      {item.lastAttemptAt ? (
                        <div className="mt-1 text-xs text-zinc-500">
                          Last attempt at {new Date(item.lastAttemptAt).toLocaleString()}
                        </div>
                      ) : null}
                      {item.providerPostId ? (
                        <div className="mt-1 break-all text-xs text-zinc-500">
                          Provider post ID: {item.providerPostId}
                        </div>
                      ) : null}
                      {item.publishedUrl ? (
                        <div className="mt-1 text-xs text-zinc-500">
                          Published link:{' '}
                          <a
                            href={item.publishedUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-300 hover:underline"
                          >
                            Open post
                          </a>
                        </div>
                      ) : null}
                      {item.platform === 'tiktok' && item.status === 'published' && !item.publishedUrl ? (
                        <div className="mt-1 text-xs text-zinc-500">
                          Uploaded to TikTok inbox. Open TikTok to finish editing and posting.
                        </div>
                      ) : null}
                      {item.errorMessage ? (
                        <div className="mt-1 text-xs text-rose-300">{item.errorMessage}</div>
                      ) : null}
                      {item.description ? (
                        <div className="mt-2 text-sm text-zinc-300">{item.description}</div>
                      ) : null}
                      {item.status !== 'published' ? (
                        <div className="mt-3">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => handlePublishNow(item.id)}
                            disabled={publishingItemId === item.id}
                          >
                            {publishingItemId === item.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Publish Now
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      </>
      ) : null}
    </div>
  );
}
