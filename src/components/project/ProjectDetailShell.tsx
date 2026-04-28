"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
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
  };
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
      <div className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</div>
      <div className="text-sm text-gray-900 dark:text-gray-100">{value}</div>
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

export function ProjectDetailShell({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [generatingScripts, setGeneratingScripts] = useState(false);
  const [creatingVideoJobs, setCreatingVideoJobs] = useState(false);
  const [processingVideoJobs, setProcessingVideoJobs] = useState(false);
  const [savingScriptId, setSavingScriptId] = useState<string | null>(null);
  const [savingRenderOptions, setSavingRenderOptions] = useState(false);
  const [savingPromoInfo, setSavingPromoInfo] = useState(false);
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
  });
  const [draftPromo, setDraftPromo] = useState({
    promoEnabled: false,
    originalPrice: '',
    salePrice: '',
    discountLabel: '',
  });

  async function loadProject(signal?: { cancelled: boolean }) {
    try {
      const result = await Api.getProject(projectId);
      if (signal?.cancelled) return;
      setProject(result as ProjectDetail);
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
      });
      setDraftPromo({
        promoEnabled: (result as ProjectDetail).promoEnabled === true,
        originalPrice: (result as ProjectDetail).promoInfo?.originalPrice ?? '',
        salePrice: (result as ProjectDetail).promoInfo?.salePrice ?? '',
        discountLabel: (result as ProjectDetail).promoInfo?.discountLabel ?? '',
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
      toast.success('Next pending job processed');
      await loadProject();
    } catch (err: any) {
      toast.error(err?.error?.message || 'Failed to process video jobs');
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

  useEffect(() => {
    const signal = { cancelled: false };
    loadProject(signal);
    return () => {
      signal.cancelled = true;
    };
  }, [projectId]);

  if (loading) {
    return <div className="mx-auto w-full max-w-6xl px-4 py-6 text-sm text-gray-500 dark:text-gray-400">Loading project...</div>;
  }

  if (loadError || !project) {
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6">
        <div className="text-sm text-red-600 dark:text-red-400">{loadError || 'Project not found'}</div>
        <div>
          <Button asChild variant="outline">
            <Link href="/workspace">Back to Workspace</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{project.title}</h1>
            <Badge variant={statusVariant(project.status)}>{project.status}</Badge>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">This is the current MVP project record. Assets, scripts, and jobs will attach here next.</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/workspace">Back to Workspace</Link>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
        <Card>
          <CardHeader className="flex-col items-start gap-1">
            <CardTitle>Project Brief</CardTitle>
            <CardDescription>Core fields saved from the create-project step.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5">
            <InfoRow label="Product Name" value={project.productName} />
            <InfoRow label="Product Description" value={project.productDescription} />
            <InfoRow label="Selling Points" value={project.sellingPoints} />
            <InfoRow label="Target Audience" value={project.targetAudience} />
          </CardContent>
        </Card>

        <div className="grid gap-6">
          <Card>
            <CardHeader className="flex-col items-start gap-1">
              <CardTitle>Settings</CardTitle>
              <CardDescription>Stored generation parameters.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <InfoRow label="Duration" value={`${project.durationSeconds} seconds`} />
              <InfoRow label="Language" value={project.language} />
              <InfoRow label="Aspect Ratio" value={project.aspectRatio} />
              <InfoRow label="Promo" value={project.promoEnabled ? 'Enabled' : 'Disabled'} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-col items-start gap-1">
              <CardTitle>Render Options</CardTitle>
              <CardDescription>Control subtitles, background music, and render pacing for the next video.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">Style Preset</div>
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
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Balanced keeps the current default. Punchy cuts faster. Calm holds shots longer with slightly softer audio.
                </div>
              </div>
              <label className="flex items-center gap-3 text-sm text-gray-900 dark:text-gray-100">
                <Checkbox
                  checked={draftRenderOptions.captionsEnabled}
                  onCheckedChange={(checked) =>
                    setDraftRenderOptions((prev) => ({ ...prev, captionsEnabled: checked === true }))
                  }
                />
                <span>Burn subtitles into output videos</span>
              </label>
              <label className="flex items-center gap-3 text-sm text-gray-900 dark:text-gray-100">
                <Checkbox
                  checked={draftRenderOptions.backgroundMusicEnabled}
                  onCheckedChange={(checked) =>
                    setDraftRenderOptions((prev) => ({ ...prev, backgroundMusicEnabled: checked === true }))
                  }
                />
                <span>Include background music</span>
              </label>
              <div>
                <Button type="button" variant="outline" onClick={handleSaveRenderOptions} disabled={savingRenderOptions}>
                  {savingRenderOptions ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Save Render Options
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-col items-start gap-1">
              <CardTitle>Promotion</CardTitle>
              <CardDescription>Optional pricing context used during script generation.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <label className="flex items-center gap-3 text-sm text-gray-900 dark:text-gray-100">
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
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">Original Price</div>
                  <Input
                    value={draftPromo.originalPrice}
                    onChange={(event) => setDraftPromo((prev) => ({ ...prev, originalPrice: event.target.value }))}
                    placeholder="$79"
                    disabled={!draftPromo.promoEnabled}
                    maxLength={80}
                  />
                </div>
                <div className="grid gap-2">
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">Sale Price</div>
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
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">Offer Details</div>
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

          <Card>
            <CardHeader className="flex-col items-start gap-1">
              <CardTitle>Pipeline Summary</CardTitle>
              <CardDescription>Current attached records for this project.</CardDescription>
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

        <Card>
          <CardHeader className="flex-col items-start gap-1">
            <div className="flex w-full items-center justify-between gap-3">
              <CardTitle>Scripts</CardTitle>
              <Button type="button" size="sm" onClick={handleGenerateScripts} disabled={generatingScripts}>
                {generatingScripts ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {project.scripts.length > 0 ? 'Regenerate Scripts' : 'Generate Scripts'}
              </Button>
            </div>
            <CardDescription>{project.scripts.length === 0 ? 'No scripts generated yet.' : `${project.scripts.length} script variants saved.`}</CardDescription>
          </CardHeader>
          <CardContent>
            {project.scripts.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-200 px-4 py-6 text-sm text-gray-500 dark:border-gray-800 dark:text-gray-400">
                Script generation is not wired yet in this phase.
              </div>
            ) : (
              <div className="space-y-3">
                {project.scripts.map((script) => (
                  <div key={script.id} className="rounded-lg border border-gray-200 px-4 py-3 dark:border-gray-800">
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

        <Card>
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
            <CardDescription>
              {project.videoJobs.length === 0
                ? 'Create one queued job per selected script.'
                : `${project.videoJobs.length} queued jobs prepared for the rendering worker.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {project.videoJobs.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-200 px-4 py-6 text-sm text-gray-500 dark:border-gray-800 dark:text-gray-400">
                Video job creation is ready. The next step is to enqueue one job per selected script.
              </div>
            ) : (
              <div className="space-y-3">
                {project.videoJobs.map((job) => (
                  <div key={job.id} className="rounded-lg border border-gray-200 px-4 py-3 dark:border-gray-800">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        Variant {job.variantIndex}: {job.styleLabel || `Script ${job.sortOrder}`}
                      </div>
                      <Badge variant={jobBadgeVariant(job.status)}>{job.status}</Badge>
                    </div>
                    <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      Created {new Date(job.createdAt).toLocaleString()}
                      {job.errorMessage ? ` • ${job.errorMessage}` : ''}
                    </div>
                    {(job.voiceoverUrl || job.ttsTimestampsUrl || job.finalUrl) ? (
                      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                        {job.voiceoverUrl ? (
                          <a href={job.voiceoverUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline dark:text-blue-400">
                            Voiceover
                          </a>
                        ) : null}
                        {job.ttsTimestampsUrl ? (
                          <a href={job.ttsTimestampsUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline dark:text-blue-400">
                            Timestamps
                          </a>
                        ) : null}
                        {job.finalUrl ? (
                          <a href={job.finalUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline dark:text-blue-400">
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

        <Card>
          <CardHeader className="flex-col items-start gap-1">
            <CardTitle>Videos</CardTitle>
            <CardDescription>{project.videos.length === 0 ? 'No output videos yet.' : `${project.videos.length} videos generated.`}</CardDescription>
          </CardHeader>
          <CardContent>
            {project.videos.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-200 px-4 py-6 text-sm text-gray-500 dark:border-gray-800 dark:text-gray-400">
                Video generation is not wired yet in this phase.
              </div>
            ) : (
              <div className="space-y-3">
                {project.videos.map((video) => (
                  <div key={video.id} className="rounded-lg border border-gray-200 px-4 py-3 dark:border-gray-800">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{video.variantLabel || 'Generated video'}</div>
                    <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {video.durationSeconds}s • {formatBytes(video.fileSizeBytes)} • {new Date(video.createdAt).toLocaleString()}
                    </div>
                    <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
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
                        className="text-sm text-blue-600 hover:underline dark:text-blue-400"
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
      </div>
    </div>
  );
}
