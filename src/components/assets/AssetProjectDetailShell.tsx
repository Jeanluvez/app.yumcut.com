"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
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

type SectionId = 'basic-info' | 'assets';

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

const SECTION_ALIGNMENT_NUDGE = 6;

function buildScriptPreview(script: AssetProjectDetail['scripts'][number]) {
  return [script.hookText, script.bodyText, script.ctaText].filter(Boolean).join('\n\n');
}

function ReadonlyField({
  label,
  value,
  multiline = false,
  compact = false,
}: {
  label: string;
  value: string;
  multiline?: boolean;
  compact?: boolean;
}) {
  return (
    <div className="grid gap-2">
      <div className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">{label}</div>
      <div
        className={`rounded-2xl border border-zinc-800 bg-zinc-950/80 text-sm text-zinc-300 ${
          compact ? 'px-3.5 py-2.5 leading-5' : 'px-4 py-3 leading-6'
        } ${
          multiline ? 'min-h-[92px] whitespace-pre-line' : ''
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
  const [activeSection, setActiveSection] = useState<SectionId>('basic-info');
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const topBarRef = useRef<HTMLDivElement | null>(null);
  const navCardRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLElement | null>(null);
  const sectionRefs = useRef<Record<SectionId, HTMLDivElement | null>>({
    'basic-info': null,
    assets: null,
  });

  function getScrollContainer() {
    if (scrollContainerRef.current) return scrollContainerRef.current;
    const container = navCardRef.current?.closest('main') as HTMLElement | null;
    scrollContainerRef.current = container;
    return container;
  }

  function alignSectionToNav(section: SectionId, behavior: ScrollBehavior = 'smooth') {
    const container = getScrollContainer();
    const target = sectionRefs.current[section];
    const navCard = navCardRef.current;
    if (!container || !target || !navCard) return;

    const topBarBottom = topBarRef.current?.getBoundingClientRect().bottom ?? 0;
    const navTop = navCard.getBoundingClientRect().top;
    const targetTop = target.getBoundingClientRect().top;
    const safeNavTop = Math.max(navTop, topBarBottom + 20);
    const nextScrollTop = container.scrollTop + (targetTop - safeNavTop) - SECTION_ALIGNMENT_NUDGE;

    container.scrollTo({
      top: Math.max(0, nextScrollTop),
      behavior,
    });
  }

  function jumpToSection(section: SectionId) {
    setActiveSection(section);
    alignSectionToNav(section, 'smooth');
    window.setTimeout(() => alignSectionToNav(section, 'auto'), 420);
  }

  function syncActiveSection() {
    const navCard = navCardRef.current;
    if (!navCard) return;

    const topBarBottom = topBarRef.current?.getBoundingClientRect().bottom ?? 0;
    const navTop = Math.max(navCard.getBoundingClientRect().top, topBarBottom + 16);
    const sections = (Object.keys(sectionRefs.current) as SectionId[]).filter(
      (section) => sectionRefs.current[section],
    );
    if (sections.length === 0) return;

    let closestSection = sections[0];
    let closestOffset = Number.POSITIVE_INFINITY;

    sections.forEach((section) => {
      const target = sectionRefs.current[section];
      if (!target) return;
      const offset = Math.abs(target.getBoundingClientRect().top - navTop);
      if (offset < closestOffset) {
        closestSection = section;
        closestOffset = offset;
      }
    });

    setActiveSection((current) => (current === closestSection ? current : closestSection));
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

  useEffect(() => {
    scrollContainerRef.current = navCardRef.current?.closest('main') as HTMLElement | null;
    syncActiveSection();
    const container = getScrollContainer();
    const handleScroll = () => syncActiveSection();
    container?.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll);
    return () => {
      container?.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, [project, assets.length]);

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
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 sm:py-4 lg:px-8">
        <div
          ref={topBarRef}
          className="sticky top-0 z-20 -mx-4 flex items-center gap-3 border-b border-zinc-800/60 bg-transparent px-4 py-3 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
        >
          <Button asChild variant="ghost" size="icon" className="h-10 w-10 rounded-2xl text-zinc-300 hover:bg-zinc-900 hover:text-zinc-100">
            <Link href="/workspace/assets" aria-label="Back to My Assets">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="min-w-0 text-xl font-semibold tracking-tight text-zinc-100">
            <span className="block truncate">{project.title || project.name || project.productName || 'Asset Project'}</span>
          </div>
        </div>

        <div className="grid items-start gap-4 pt-0 xl:grid-cols-[220px_minmax(0,1fr)]">
          <div className="xl:sticky xl:top-[88px] xl:self-start">
            <Card ref={navCardRef} className="rounded-[28px] border-zinc-800 bg-zinc-900/70 text-zinc-100">
              <CardContent className="space-y-3 p-4">
                {[
                  { id: 'basic-info' as const, label: 'Basic Info' },
                  { id: 'assets' as const, label: 'Assets' },
                ].map((section) => (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => jumpToSection(section.id)}
                    className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                      activeSection === section.id
                        ? 'border-blue-500/50 bg-blue-500/10'
                        : 'border-zinc-800 bg-zinc-950/70 hover:border-zinc-700'
                    }`}
                  >
                    <div className="text-sm font-medium text-zinc-100">{section.label}</div>
                  </button>
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="self-start space-y-6">
            <div
              id="basic-info"
              ref={(node) => {
                sectionRefs.current['basic-info'] = node;
              }}
            >
              <Card className="rounded-[28px] border-zinc-800 bg-zinc-900/70 text-zinc-100">
                <CardHeader className="flex-col items-start gap-2">
                  <CardTitle>Basic Info</CardTitle>
                  <CardDescription className="text-zinc-400">
                    Core product details that help describe and highlight what makes this product compelling.
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
                        <ReadonlyField label="Selected Assets" value={String(project.selectedAssetIds.length)} compact />
                        <ReadonlyField label="Hook Clip" value={project.hookAssetId ? 'Attached' : 'Not attached'} compact />
                        <ReadonlyField label="Uploaded Files" value={String(project.counts.uploadedAssets ?? project.counts.assets)} compact />
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
                                <div className="text-base font-medium text-zinc-100">
                                  {script.styleLabel || `Script ${script.sortOrder}`}
                                </div>
                                <div className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs text-zinc-300">
                                  Selected
                                </div>
                              </div>
                              <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm leading-6 whitespace-pre-line text-zinc-300">
                                {buildScriptPreview(script) || 'Not set'}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div
              id="assets"
              ref={(node) => {
                sectionRefs.current.assets = node;
              }}
            >
              <Card className="rounded-[28px] border-zinc-800 bg-zinc-900/70 text-zinc-100">
                <CardHeader className="flex-col items-start gap-2">
                  <CardTitle>Assets</CardTitle>
                  <CardDescription className="text-zinc-400">
                    Visual product assets, including images and video materials used to shape the final creative output.
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
      </div>

      <Dialog open={previewIndex !== null} onOpenChange={(open) => !open && setPreviewIndex(null)}>
        <DialogContent className="top-1/2 z-50 w-[min(96vw,1100px)] max-w-5xl -translate-y-1/2 overflow-hidden rounded-[28px] border-zinc-800 bg-zinc-950 p-0 text-zinc-100 shadow-2xl">
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

              <div className="flex max-h-[78vh] min-h-[70vh] items-center justify-center bg-black p-6 sm:p-8">
                {previewAsset.type === 'video' || previewAsset.type === 'hook' || previewAsset.mimeType.startsWith('video') ? (
                  <video
                    src={previewAsset.storageUrl}
                    controls
                    className="max-h-[calc(78vh-4rem)] w-full rounded-2xl bg-black"
                  />
                ) : (
                  <img
                    src={previewAsset.storageUrl}
                    alt={previewAsset.filename}
                    className="max-h-[calc(78vh-4rem)] w-auto max-w-full rounded-2xl object-contain"
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
