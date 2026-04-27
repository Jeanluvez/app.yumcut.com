"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Api } from '@/lib/api-client';
import { useProjects } from '@/components/providers/ProjectsProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  project: {
    id: string;
    name: string;
  } | null;
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

function formatBytes(value: string) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes <= 0) return 'Unknown size';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function WorkspaceShell() {
  const { items, loading, refresh } = useProjects();
  const [form, setForm] = useState<FormState>(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [videosLoading, setVideosLoading] = useState(true);
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(true);
  const [assetFilter, setAssetFilter] = useState<'all' | 'image' | 'video' | 'hook'>('all');

  const projectCountLabel = useMemo(() => `${items.length} project${items.length === 1 ? '' : 's'}`, [items.length]);
  const videoCountLabel = useMemo(() => `${videos.length} video${videos.length === 1 ? '' : 's'}`, [videos.length]);
  const filteredAssets = useMemo(
    () => (assetFilter === 'all' ? assets : assets.filter((asset) => asset.type === assetFilter)),
    [assets, assetFilter],
  );
  const assetCountLabel = useMemo(
    () => `${filteredAssets.length} asset${filteredAssets.length === 1 ? '' : 's'}`,
    [filteredAssets.length],
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
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Workspace</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Create a project record first. Script generation and assets come next.</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <Card>
          <CardHeader className="flex-col items-start gap-1">
            <CardTitle>New Project</CardTitle>
            <CardDescription>Minimum fields only. This step creates the base project row in Supabase.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4" onSubmit={handleSubmit}>
              <div className="grid gap-2">
                <Label htmlFor="name">Project Name</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="Spring launch UGC batch"
                  maxLength={120}
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="productName">Product Name</Label>
                <Input
                  id="productName"
                  value={form.productName}
                  onChange={(event) => setForm((prev) => ({ ...prev, productName: event.target.value }))}
                  placeholder="Sprokl Studio"
                  maxLength={120}
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="productDescription">Product Description</Label>
                <Textarea
                  id="productDescription"
                  value={form.productDescription}
                  onChange={(event) => setForm((prev) => ({ ...prev, productDescription: event.target.value }))}
                  placeholder="Describe the product in plain language."
                  maxLength={2000}
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="sellingPoints">Selling Points</Label>
                <Textarea
                  id="sellingPoints"
                  value={form.sellingPoints}
                  onChange={(event) => setForm((prev) => ({ ...prev, sellingPoints: event.target.value }))}
                  placeholder="List the strongest product angles and hooks."
                  maxLength={2000}
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="targetAudience">Target Audience</Label>
                <Textarea
                  id="targetAudience"
                  value={form.targetAudience}
                  onChange={(event) => setForm((prev) => ({ ...prev, targetAudience: event.target.value }))}
                  placeholder="Who should this ad speak to?"
                  maxLength={500}
                  required
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="grid gap-2">
                  <Label>Duration</Label>
                  <Select value={form.durationSeconds} onValueChange={(value: FormState['durationSeconds']) => setForm((prev) => ({ ...prev, durationSeconds: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select duration" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">30 seconds</SelectItem>
                      <SelectItem value="60">60 seconds</SelectItem>
                      <SelectItem value="90">90 seconds</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label>Language</Label>
                  <Select value={form.language} onValueChange={(value: FormState['language']) => setForm((prev) => ({ ...prev, language: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select language" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="es">Spanish</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label>Aspect Ratio</Label>
                  <Select value={form.aspectRatio} onValueChange={(value: FormState['aspectRatio']) => setForm((prev) => ({ ...prev, aspectRatio: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select ratio" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="vertical_9_16">9:16</SelectItem>
                      <SelectItem value="square_1_1">1:1</SelectItem>
                      <SelectItem value="landscape_16_9">16:9</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end">
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Creating...' : 'Create Project'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="grid min-w-0 gap-6">
          <Card>
            <CardHeader className="flex-col items-start gap-1">
              <CardTitle>Recent Projects</CardTitle>
              <CardDescription>{loading ? 'Loading projects...' : projectCountLabel}</CardDescription>
            </CardHeader>
            <CardContent>
              {items.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-200 px-4 py-8 text-sm text-gray-500 dark:border-gray-800 dark:text-gray-400">
                  No projects yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {items.map((item: any) => (
                    <Link key={item.id} href={`/project/${item.id}`} className="block min-w-0 rounded-lg border border-gray-200 px-4 py-3 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-900">
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{item.title || item.name || 'Untitled project'}</div>
                      <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        <span>{formatStatus(item.status)}</span>
                        <span className="mx-2">•</span>
                        <span>{item.createdAt ? new Date(item.createdAt).toLocaleString() : 'Unknown time'}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-col items-start gap-1">
              <CardTitle>My Videos</CardTitle>
              <CardDescription>{videosLoading ? 'Loading videos...' : videoCountLabel}</CardDescription>
            </CardHeader>
            <CardContent>
              {videos.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-200 px-4 py-8 text-sm text-gray-500 dark:border-gray-800 dark:text-gray-400">
                  No videos generated yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {videos.map((video) => (
                    <div key={video.id} className="min-w-0 rounded-lg border border-gray-200 px-4 py-3 dark:border-gray-800">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <Link href={`/project/${video.project.id}`} className="text-sm font-medium text-gray-900 hover:underline dark:text-gray-100">
                            {video.project.name}
                          </Link>
                          <div className="mt-1 truncate text-xs text-gray-500 dark:text-gray-400">
                            {video.variantLabel || 'Generated video'}
                          </div>
                          <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            {video.durationSeconds}s • {formatBytes(video.fileSizeBytes)} • {new Date(video.createdAt).toLocaleString()}
                          </div>
                          <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            Downloads: {video.downloadCount} • Expires {new Date(video.expiresAt).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-wrap items-center gap-2">
                          <Button asChild size="sm" variant="outline">
                            <a href={`/api/videos/${video.id}/download`}>Download</a>
                          </Button>
                          <Button asChild size="sm" variant="ghost">
                            <Link href={`/project/${video.project.id}`}>Open</Link>
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-col items-start gap-3">
              <div>
                <CardTitle>My Assets</CardTitle>
                <CardDescription>{assetsLoading ? 'Loading assets...' : assetCountLabel}</CardDescription>
              </div>
              <div className="w-full max-w-[180px]">
                <Select value={assetFilter} onValueChange={(value: 'all' | 'image' | 'video' | 'hook') => setAssetFilter(value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter assets" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All types</SelectItem>
                    <SelectItem value="image">Images</SelectItem>
                    <SelectItem value="video">Videos</SelectItem>
                    <SelectItem value="hook">Hook videos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {filteredAssets.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-200 px-4 py-8 text-sm text-gray-500 dark:border-gray-800 dark:text-gray-400">
                  No assets found for this filter.
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredAssets.map((asset) => (
                    <div key={asset.id} className="min-w-0 rounded-lg border border-gray-200 px-4 py-3 dark:border-gray-800">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{asset.filename}</div>
                          <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            {asset.type} • {formatBytes(asset.sizeBytes)} • {new Date(asset.createdAt).toLocaleString()}
                          </div>
                          <div className="mt-1 break-words text-xs text-gray-500 dark:text-gray-400">
                            {asset.project ? (
                              <>
                                Project:{' '}
                                <Link href={`/project/${asset.project.id}`} className="hover:underline">
                                  {asset.project.name}
                                </Link>
                              </>
                            ) : (
                              'No project'
                            )}
                            <span className="mx-2">•</span>
                            Expires {new Date(asset.expiresAt).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-wrap items-center gap-2">
                          <Button asChild size="sm" variant="outline">
                            <a href={asset.storageUrl} target="_blank" rel="noreferrer">Open</a>
                          </Button>
                          {asset.project ? (
                            <Button asChild size="sm" variant="ghost">
                              <Link href={`/project/${asset.project.id}`}>Project</Link>
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
