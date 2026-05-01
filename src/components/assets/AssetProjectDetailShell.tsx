"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Film,
  Image as ImageIcon,
  Play,
} from 'lucide-react';
import { toast } from 'sonner';
import { Api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

type AssetProjectDetail = {
  id: string;
  title: string;
  name: string;
  productName: string;
  productDescription: string;
  sellingPoints: string;
  targetAudience: string;
  selectedAssetIds: string[];
  hookAssetId: string | null;
  durationSeconds: number;
  aspectRatio: string;
  language: string;
  createdAt: string;
  updatedAt: string;
  counts: {
    assets: number;
    uploadedAssets?: number;
    videos: number;
    scripts?: number;
  };
  scripts?: Array<{
    id: string;
    styleLabel: string;
    hookText: string;
    bodyText: string;
    ctaText: string;
    isSelected: boolean;
    sortOrder: number;
  }>;
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
};

type SectionId = 'task-inputs' | 'assets';

function formatBytes(value: string) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(seconds: number | null | undefined) {
  if (!seconds || !Number.isFinite(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const remain = seconds % 60;
  return `${mins}:${String(remain).padStart(2, '0')}`;
}

function formatAspectRatio(value: string) {
  if (value === 'square_1_1') return '1:1';
  if (value === 'landscape_16_9') return '16:9';
  return '9:16';
}

function formatLanguage(value: string) {
  if (value === 'es') return 'Spanish';
  return 'English';
}

function ReadonlyField({
  label,
  value,
  multiline = false,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) {
  return (
    <div className="grid gap-3">
      <div className="text-sm font-medium text-zinc-100">{label}</div>
      <div
        className={`rounded-2xl border border-zinc-800 bg-zinc-950/80 px-4 py-4 text-zinc-300 ${
          multiline ? 'min-h-[110px] whitespace-pre-line leading-7' : ''
        }`}
      >
        {value || 'Not set'}
      </div>
    </div>
  );
}

export function AssetProjectDetailShell({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<AssetProjectDetail | null>(null);
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<SectionId>('task-inputs');
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  function jumpToSection(section: SectionId) {
    setActiveSection(section);
    if (typeof window === 'undefined') return;
    const target = document.getElementById(section);
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function loadData(signal?: { cancelled: boolean }) {
    try {
      const [projectResult, assetResult] = await Promise.all([
        Api.getProject(projectId),
        Api.getAssets(projectId),
      ]);
      if (signal?.cancelled) return;
      setProject(projectResult as AssetProjectDetail);
      setAssets(Array.isArray(assetResult) ? (assetResult as AssetItem[]) : []);
      setLoadError(null);
    } catch (err: any) {
      if (signal?.cancelled) return;
      setLoadError(err?.error?.message || 'Failed to load asset project');
      toast.error(err?.error?.message || 'Failed to load asset project');
    } finally {
      if (!signal?.cancelled) setLoading(false);
    }
  }

  useEffect(() => {
    const signal = { cancelled: false };
    loadData(signal);
    return () => {
      signal.cancelled = true;
    };
  }, [projectId]);

  const selectedScripts = useMemo(
    () => (project?.scripts ?? []).filter((script) => script.isSelected),
    [project],
  );
  const previewAsset = previewIndex === null ? null : assets[previewIndex] ?? null;
  const canGoPrev = previewIndex !== null && previewIndex > 0;
  const canGoNext = previewIndex !== null && previewIndex < assets.length - 1;

  if (loading) {
    return <div className="mx-auto w-full max-w-7xl px-4 py-6 text-sm text-zinc-500">Loading asset project...</div>;
  }

  if (loadError || !project) {
    return (
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-6">
        <div className="text-sm text-rose-300">{loadError || 'Asset project not found'}</div>
        <div>
          <Button asChild variant="outline" className="border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800">
            <Link href="/workspace/assets">Back to My Assets</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
          <div className="space-y-4 xl:sticky xl:top-12 xl:self-start">
            <Button asChild variant="ghost" className="h-10 rounded-2xl px-3 text-zinc-300 hover:bg-zinc-900 hover:text-zinc-100">
              <Link href="/workspace/assets">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to My Assets
              </Link>
            </Button>

            <Card className="rounded-[28px] border-zinc-800 bg-zinc-900/70 text-zinc-100">
              <CardHeader className="flex-col items-start gap-2">
                <CardTitle className="text-2xl tracking-tight">
                  {project.title || project.name || project.productName || 'Asset Project'}
                </CardTitle>
                <CardDescription className="text-zinc-400">
                  Switch between the original task inputs and the uploaded asset library.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { id: 'task-inputs' as const, label: 'Task Inputs', description: 'Review the create flow fields' },
                  { id: 'assets' as const, label: 'Assets', description: 'Browse images, videos, and hook clips' },
                ].map((section) => (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => jumpToSection(section.id)}
                    className={`w-full rounded-2xl border px-5 py-4 text-left transition ${
                      activeSection === section.id
                        ? 'border-blue-500/50 bg-blue-500/10'
                        : 'border-zinc-800 bg-zinc-950/70 hover:border-zinc-700'
                    }`}
                  >
                    <div className="text-lg font-medium text-zinc-100">{section.label}</div>
                    <div className="mt-2 text-sm text-zinc-500">{section.description}</div>
                  </button>
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card id="task-inputs" className="rounded-[28px] border-zinc-800 bg-zinc-900/70 text-zinc-100">
                <CardHeader className="flex-col items-start gap-2">
                  <CardTitle>Task Inputs</CardTitle>
                  <CardDescription className="text-zinc-400">
                    The original fields captured from the first four create-task steps.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-8">
                  <div className="space-y-5">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">Step 1 · Product Brief</div>
                      <div className="mt-3 grid gap-5 xl:grid-cols-2">
                        <ReadonlyField label="Product Name" value={project.productName} />
                        <ReadonlyField label="Target Audience" value={project.targetAudience} />
                        <div className="xl:col-span-2">
                          <ReadonlyField label="Product Description" value={project.productDescription} multiline />
                        </div>
                        <div className="xl:col-span-2">
                          <ReadonlyField label="Selling Points" value={project.sellingPoints} multiline />
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">Step 2 · Media Selection</div>
                      <div className="mt-3 grid gap-4 md:grid-cols-3">
                        <ReadonlyField label="Selected Assets" value={String(project.selectedAssetIds.length)} />
                        <ReadonlyField label="Hook Clip" value={project.hookAssetId ? 'Attached' : 'Not attached'} />
                        <ReadonlyField label="Uploaded Files" value={String(project.counts.uploadedAssets ?? project.counts.assets)} />
                      </div>
                    </div>

                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">Step 3 · Settings</div>
                      <div className="mt-3 grid gap-4 md:grid-cols-3">
                        <ReadonlyField label="Duration" value={`${project.durationSeconds}s`} />
                        <ReadonlyField label="Language" value={formatLanguage(project.language)} />
                        <ReadonlyField label="Aspect Ratio" value={formatAspectRatio(project.aspectRatio)} />
                      </div>
                    </div>

                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">Step 4 · Scripts</div>
                      <div className="mt-3 space-y-4">
                        {selectedScripts.length === 0 ? (
                          <div className="rounded-2xl border border-dashed border-zinc-800 px-4 py-6 text-sm text-zinc-500">
                            No selected scripts were saved for this project.
                          </div>
                        ) : (
                          selectedScripts.map((script) => (
                            <div key={script.id} className="rounded-3xl border border-zinc-800 bg-zinc-950/80 p-5">
                              <div className="flex items-center justify-between gap-3">
                                <div className="text-lg font-medium text-zinc-100">
                                  {script.styleLabel || `Script ${script.sortOrder}`}
                                </div>
                                <div className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs text-zinc-300">
                                  Selected
                                </div>
                              </div>
                              <div className="mt-4 grid gap-4">
                                <ReadonlyField label="Hook" value={script.hookText} multiline />
                                <ReadonlyField label="Body" value={script.bodyText} multiline />
                                <ReadonlyField label="CTA" value={script.ctaText} multiline />
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card id="assets" className="rounded-[28px] border-zinc-800 bg-zinc-900/70 text-zinc-100">
                <CardHeader className="flex-col items-start gap-2">
                  <CardTitle>Assets</CardTitle>
                  <CardDescription className="text-zinc-400">
                    Click any image or video to preview it in a larger lightbox and move left or right through the project assets.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  {assets.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-zinc-800 px-4 py-10 text-sm text-zinc-500">
                      No assets uploaded for this project yet.
                    </div>
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                      {assets.map((asset, index) => {
                        const isVideo = asset.type === 'video' || asset.type === 'hook' || asset.mimeType.startsWith('video');
                        return (
                          <button
                            key={asset.id}
                            type="button"
                            onClick={() => setPreviewIndex(index)}
                            className="overflow-hidden rounded-[24px] border border-zinc-800 bg-zinc-950 text-left transition hover:border-zinc-700"
                          >
                            <div className="relative h-56 bg-zinc-900">
                              {asset.thumbnailUrl ? (
                                <img
                                  src={asset.thumbnailUrl}
                                  alt={asset.filename}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-900 via-zinc-950 to-zinc-900">
                                  {isVideo ? (
                                    <Film className="h-8 w-8 text-zinc-400" />
                                  ) : (
                                    <ImageIcon className="h-8 w-8 text-zinc-400" />
                                  )}
                                </div>
                              )}
                              {isVideo ? (
                                <>
                                  <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="rounded-full bg-black/45 p-3 text-white backdrop-blur">
                                      <Play className="h-5 w-5 fill-current" />
                                    </div>
                                  </div>
                                  <div className="absolute bottom-3 left-3 rounded-lg bg-black/55 px-2 py-1 text-[11px] font-semibold text-white">
                                    {formatDuration(asset.durationSeconds)}
                                  </div>
                                </>
                              ) : null}
                            </div>
                            <div className="space-y-2 p-4">
                              <div className="truncate text-sm font-medium text-zinc-100">{asset.filename}</div>
                              <div className="flex items-center justify-between gap-3 text-xs text-zinc-500">
                                <span>{isVideo ? 'Video' : 'Image'}</span>
                                <span>{formatBytes(asset.sizeBytes)}</span>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
          </div>
        </div>
      </div>

      <Dialog open={previewIndex !== null} onOpenChange={(open) => !open && setPreviewIndex(null)}>
        <DialogContent className="max-w-5xl border-zinc-800 bg-zinc-950 p-0 text-zinc-100">
          <DialogTitle className="sr-only">Asset Preview</DialogTitle>
          {previewAsset ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setPreviewIndex((current) => (current === null ? current : Math.max(0, current - 1)))}
                disabled={!canGoPrev}
                className="absolute left-4 top-1/2 z-10 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-2xl border border-zinc-700 bg-black/50 text-zinc-100 backdrop-blur transition hover:border-zinc-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => setPreviewIndex((current) => (current === null ? current : Math.min(assets.length - 1, current + 1)))}
                disabled={!canGoNext}
                className="absolute right-4 top-1/2 z-10 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-2xl border border-zinc-700 bg-black/50 text-zinc-100 backdrop-blur transition hover:border-zinc-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronRight className="h-5 w-5" />
              </button>

              <div className="flex min-h-[70vh] items-center justify-center bg-black p-10">
                {previewAsset.type === 'video' || previewAsset.type === 'hook' || previewAsset.mimeType.startsWith('video') ? (
                  <video
                    src={previewAsset.storageUrl}
                    controls
                    className="max-h-[70vh] w-full rounded-2xl bg-black"
                  />
                ) : (
                  <img
                    src={previewAsset.storageUrl}
                    alt={previewAsset.filename}
                    className="max-h-[70vh] w-auto rounded-2xl object-contain"
                  />
                )}
              </div>

              <div className="border-t border-zinc-800 px-6 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-base font-medium text-zinc-100">{previewAsset.filename}</div>
                    <div className="mt-1 text-sm text-zinc-500">
                      {previewIndex !== null ? `${previewIndex + 1} / ${assets.length}` : null}
                      {' · '}
                      {formatBytes(previewAsset.sizeBytes)}
                      {previewAsset.durationSeconds ? ` · ${formatDuration(previewAsset.durationSeconds)}` : ''}
                    </div>
                  </div>
                  <a
                    href={previewAsset.storageUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-100 hover:border-zinc-600 hover:bg-zinc-800"
                  >
                    Open Original
                  </a>
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
