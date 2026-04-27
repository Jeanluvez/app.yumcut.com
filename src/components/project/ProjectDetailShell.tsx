"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Api } from '@/lib/api-client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  promoInfo: unknown;
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

export function ProjectDetailShell({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [generatingScripts, setGeneratingScripts] = useState(false);
  const [creatingVideoJobs, setCreatingVideoJobs] = useState(false);
  const [processingVideoJobs, setProcessingVideoJobs] = useState(false);

  async function loadProject(signal?: { cancelled: boolean }) {
    try {
      const result = await Api.getProject(projectId);
      if (signal?.cancelled) return;
      setProject(result as ProjectDetail);
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
      toast.success('Pending jobs processed');
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
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{script.styleLabel || `Variant ${script.sortOrder}`}</div>
                      <Badge variant={script.isSelected ? 'success' : 'default'}>{script.isSelected ? 'selected' : 'inactive'}</Badge>
                    </div>
                    <div className="mt-2 space-y-2 text-sm text-gray-600 dark:text-gray-300">
                      <div>{script.hookText}</div>
                      <div>{script.bodyText}</div>
                      <div>{script.ctaText}</div>
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
                  Process Pending Jobs
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
                      {video.durationSeconds}s • {new Date(video.createdAt).toLocaleString()}
                    </div>
                    <a
                      href={video.storageUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-block text-sm text-blue-600 hover:underline dark:text-blue-400"
                    >
                      Open file
                    </a>
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
