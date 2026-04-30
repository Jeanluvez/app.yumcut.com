"use client";

import Link from 'next/link';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Check,
  Clock3,
  Clapperboard,
  FileText,
  FolderOpen,
  Globe2,
  ImagePlus,
  Image as ImageIcon,
  Loader2,
  Monitor,
  PlayCircle,
  Square,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Upload,
  Video,
  Mic,
} from 'lucide-react';
import { Api } from '@/lib/api-client';

type StepId = 1 | 2 | 3 | 4 | 5;

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
  project?: {
    id: string;
    name: string;
  } | null;
};

type LocalUploadItem = {
  id: string;
  name: string;
  size: string;
  kind: 'video' | 'image';
};

type ProductBriefDraft = {
  productName: string;
  productDescription: string;
  sellingPoints: string;
  targetAudience: string;
  productUrl: string;
};

type SettingsDraft = {
  aspectRatio: '9:16' | '1:1' | '16:9';
  duration: 30 | 60 | 90;
  language: 'en' | 'es';
  voice: 'nova-female' | 'echo-male' | 'alloy-neutral';
  music: 'upbeat-trending' | 'chill-lofi' | 'dramatic-cinematic' | 'none';
};

const STEPS = [
  {
    id: 1 as StepId,
    label: 'Media',
    description: 'Select the source media and hook footage.',
    icon: ImagePlus,
  },
  {
    id: 2 as StepId,
    label: 'Product Brief',
    description: 'Define the ad concept or paste the script.',
    icon: FileText,
  },
  {
    id: 3 as StepId,
    label: 'Settings',
    description: 'Tune duration, language, character, and mode.',
    icon: SlidersHorizontal,
  },
  {
    id: 4 as StepId,
    label: 'Scripts',
    description: 'Generate and refine the script variants.',
    icon: Sparkles,
  },
  {
    id: 5 as StepId,
    label: 'Render',
    description: 'Review the task and create the project.',
    icon: Clapperboard,
  },
] as const;

const ASPECT_RATIOS = [
  { value: '9:16' as const, label: '9:16', desc: 'TikTok / Reels', icon: Smartphone },
  { value: '1:1' as const, label: '1:1', desc: 'Square', icon: Square },
  { value: '16:9' as const, label: '16:9', desc: 'YouTube', icon: Monitor },
] as const;

const DURATIONS = [
  { value: 30 as const, label: '30s', desc: 'Quick hook' },
  { value: 60 as const, label: '60s', desc: 'Standard' },
  { value: 90 as const, label: '90s', desc: 'Deep dive' },
] as const;

const LANGUAGES = [
  { value: 'en' as const, label: 'English', flag: 'EN' },
  { value: 'es' as const, label: 'Español', flag: 'ES' },
] as const;

const VOICES = [
  { value: 'nova-female' as const, label: 'Nova', desc: 'Warm and conversational' },
  { value: 'echo-male' as const, label: 'Echo', desc: 'Confident and energetic' },
  { value: 'alloy-neutral' as const, label: 'Alloy', desc: 'Balanced and professional' },
] as const;

const MUSIC_OPTIONS = [
  { value: 'upbeat-trending' as const, label: 'Upbeat Trending', desc: 'High energy and short-form ready' },
  { value: 'chill-lofi' as const, label: 'Chill Lo-Fi', desc: 'Relaxed and aesthetic' },
  { value: 'dramatic-cinematic' as const, label: 'Dramatic Cinematic', desc: 'Emotional and punchy' },
  { value: 'none' as const, label: 'No Music', desc: 'Voiceover only' },
] as const;

function formatBytes(value: string) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function WizardProgress({
  currentStep,
  onSelect,
}: {
  currentStep: StepId;
  onSelect: (step: StepId) => void;
}) {
  const progressPct = ((currentStep - 1) / (STEPS.length - 1)) * 100;

  return (
    <div className="rounded-[28px] border border-white/8 bg-black/20 px-4 py-5 sm:px-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-200/80">Create Video Task</p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-white sm:text-2xl">
            Step {currentStep} of {STEPS.length}
          </h2>
        </div>
        <p className="max-w-xs text-right text-xs leading-5 text-zinc-500 sm:text-sm">
          Click any step to switch the editing surface below, matching your preferred wizard flow.
        </p>
      </div>

      <div className="relative mb-5 h-1 rounded-full bg-zinc-800">
        <div
          className="gradient-primary absolute left-0 top-0 h-full rounded-full transition-all duration-300"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-5">
        {STEPS.map(({ id, label, icon: Icon }) => {
          const isActive = currentStep === id;
          const isCompleted = id < currentStep;

          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelect(id)}
              className={[
                'rounded-2xl border px-3 py-3 text-left transition-all duration-200',
                isActive
                  ? 'border-blue-400/40 bg-blue-500/10 shadow-[0_0_0_1px_rgba(96,165,250,0.18)]'
                  : isCompleted
                    ? 'border-zinc-700 bg-zinc-900/90 hover:border-zinc-600'
                    : 'border-zinc-800 bg-zinc-950/70 hover:border-zinc-700',
              ].join(' ')}
            >
              <div className="flex items-start justify-between gap-3">
                <div
                  className={[
                    'flex h-10 w-10 items-center justify-center rounded-2xl border',
                    isActive
                      ? 'border-blue-400/30 bg-blue-500/15 text-blue-200'
                      : isCompleted
                        ? 'border-zinc-700 bg-zinc-800 text-zinc-100'
                        : 'border-zinc-800 bg-zinc-900 text-zinc-500',
                  ].join(' ')}
                >
                  {isCompleted ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                </div>
                <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                  0{id}
                </span>
              </div>
              <p className={['mt-4 text-sm font-semibold', isActive ? 'text-white' : 'text-zinc-200'].join(' ')}>
                {label}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StepPanel({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-[28px] border border-white/8 bg-zinc-950/75 p-5 shadow-[0_24px_80px_rgba(15,23,42,0.38)] sm:p-6">
      <div className="mb-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-blue-200/80">{eyebrow}</p>
        <h3 className="mt-2 text-2xl font-semibold tracking-tight text-white">{title}</h3>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">{description}</p>
      </div>
      {children}
    </div>
  );
}

function MediaStep({ onNext }: { onNext: () => void }) {
  const [activeTab, setActiveTab] = useState<'library' | 'upload'>('library');
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [localUploads, setLocalUploads] = useState<LocalUploadItem[]>([]);
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadAssets() {
      setLoading(true);
      try {
        const result = await Api.getAssets();
        if (!cancelled) {
          setAssets(Array.isArray(result) ? (result as AssetItem[]) : []);
        }
      } catch {
        if (!cancelled) {
          setAssets([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadAssets();

    return () => {
      cancelled = true;
    };
  }, []);

  const libraryAssets = assets.filter((item) => item.type !== 'hook').slice(0, 9);
  const hookAssets = assets.filter((item) => item.type === 'hook').slice(0, 3);

  function toggleAsset(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  }

  function handleLocalFiles(files: FileList | null) {
    if (!files?.length) return;

    const nextFiles = Array.from(files).map((file, index) => ({
      id: `${file.name}-${file.size}-${Date.now()}-${index}`,
      name: file.name,
      size: formatBytes(String(file.size)),
      kind: file.type.startsWith('video') ? 'video' : 'image',
    } as LocalUploadItem));

    setLocalUploads((prev) => [...prev, ...nextFiles]);
  }

  return (
    <StepPanel
      eyebrow="Step 01"
      title="Choose the media that anchors this ad"
      description="This step now follows the asset-first structure from your frontend reference. It reuses the current Sprokl asset library and keeps creation flow changes limited to the homepage wizard."
    >
      <div className="space-y-5">
        <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-xl p-1 w-fit">
          <button
            type="button"
            onClick={() => setActiveTab('library')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
              activeTab === 'library' ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <FolderOpen className="h-4 w-4" />
            My Library ({assets.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
              activeTab === 'upload' ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Upload className="h-4 w-4" />
            Upload New
          </button>
        </div>

        {activeTab === 'library' ? (
          <div className="space-y-5">
            {selectedIds.length > 0 ? (
              <div className="flex items-center gap-2 text-xs text-blue-300 font-medium bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-2">
                <Check className="h-3.5 w-3.5" />
                {selectedIds.length} assets selected for this draft flow
              </div>
            ) : null}

            {loading ? (
              <div className="flex min-h-[220px] items-center justify-center rounded-3xl border border-zinc-800 bg-zinc-900/60">
                <div className="flex items-center gap-2 text-sm text-zinc-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading asset library
                </div>
              </div>
            ) : libraryAssets.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {libraryAssets.map((asset) => {
                  const isSelected = selectedIds.includes(asset.id);
                  const isVideo = asset.mimeType.startsWith('video') || asset.type === 'video';
                  const previewUrl = isVideo ? asset.thumbnailUrl : (asset.thumbnailUrl || asset.storageUrl);

                  return (
                    <button
                      key={asset.id}
                      type="button"
                      onClick={() => toggleAsset(asset.id)}
                      className={`relative overflow-hidden rounded-2xl border text-left transition-all duration-150 ${
                        isSelected
                          ? 'border-blue-400/50 ring-1 ring-blue-400/30 bg-blue-500/10'
                          : 'border-zinc-700/70 bg-zinc-900 hover:border-zinc-600'
                      }`}
                    >
                      <div className="relative h-32 bg-zinc-800/80">
                        {previewUrl ? (
                          <img
                            src={previewUrl}
                            alt={asset.filename}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center">
                            {isVideo ? <Video className="h-6 w-6 text-zinc-600" /> : <ImageIcon className="h-6 w-6 text-zinc-600" />}
                          </div>
                        )}
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                          <div className="flex items-center justify-between text-[10px] font-medium text-zinc-200">
                            <span>{isVideo ? 'Video' : 'Image'}</span>
                            <span>{formatBytes(asset.sizeBytes)}</span>
                          </div>
                        </div>
                        {isSelected ? (
                          <div className="absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 text-white">
                            <Check className="h-3.5 w-3.5" />
                          </div>
                        ) : null}
                      </div>
                      <div className="p-3">
                        <p className="truncate text-sm font-medium text-zinc-200">{asset.filename}</p>
                        <p className="mt-1 text-xs text-zinc-500">
                          {asset.project?.name ? `From ${asset.project.name}` : 'Library asset'}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-8 text-center">
                <p className="text-base font-semibold text-white">No media assets yet</p>
                <p className="mt-2 text-sm leading-6 text-zinc-400">
                  Use the existing workspace upload flow first, then come back to start this wizard from your library.
                </p>
                <Link
                  href="/workspace#assets-section"
                  className="mt-4 inline-flex rounded-xl border border-blue-400/20 bg-blue-500/10 px-4 py-2.5 text-sm font-medium text-blue-100 transition hover:bg-blue-500/15"
                >
                  Open My Assets
                </Link>
              </div>
            )}

            <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-3xl border border-zinc-800 bg-zinc-900/80 p-5">
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-blue-400/20 bg-blue-500/10 text-blue-200">
                    <FolderOpen className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-base font-semibold text-white">Use existing assets</p>
                    <p className="mt-1 text-sm leading-6 text-zinc-400">
                      The homepage now starts from your real asset library instead of a duplicate local step block.
                    </p>
                  </div>
                </div>
                <div className="mt-5 flex flex-wrap gap-3">
                  <Link
                    href="/workspace#assets-section"
                    className="rounded-xl border border-blue-400/20 bg-blue-500/10 px-4 py-2.5 text-sm font-medium text-blue-100 transition hover:bg-blue-500/15"
                  >
                    Manage library
                  </Link>
                  <button
                    type="button"
                    onClick={onNext}
                    className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm font-medium text-zinc-200 transition hover:border-zinc-600 hover:bg-zinc-800"
                  >
                    Continue to Product Brief
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-3xl border border-zinc-800 bg-zinc-900/80 p-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-violet-400/20 bg-violet-500/10 text-violet-200">
                      <PlayCircle className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">Hook clip</p>
                      <p className="mt-1 text-xs leading-5 text-zinc-500">
                        {hookAssets.length > 0
                          ? `${hookAssets.length} hook clips already exist in your library.`
                          : 'Keep a short opener ready for the first few seconds of the ad.'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl border border-zinc-800 bg-zinc-900/80 p-5">
                  <p className="text-sm font-semibold text-white">Migration note</p>
                  <p className="mt-2 text-sm leading-6 text-zinc-400">
                    Upload and final asset assignment still use the working project and workspace modules in this phase.
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-3xl border-2 border-dashed border-zinc-700 bg-zinc-900/60 p-10 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-800 text-zinc-400">
                <Upload className="h-5 w-5" />
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="video/*,image/*"
                className="hidden"
                onChange={(event) => {
                  handleLocalFiles(event.target.files);
                  event.target.value = '';
                }}
              />
              <p className="mt-4 text-sm font-semibold text-zinc-200">Upload new media from your local device</p>
              <p className="mt-2 text-sm leading-6 text-zinc-500">
                Choose local video clips or product images first. This phase keeps the files in the homepage draft surface and does not change the backend project pipeline yet.
              </p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-5 inline-flex rounded-xl gradient-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
              >
                Select local files
              </button>
            </div>

            {localUploads.length > 0 ? (
              <div className="space-y-2">
                {localUploads.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/80 px-4 py-3"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-2xl border border-zinc-700 bg-zinc-800 text-zinc-300">
                      {file.kind === 'video' ? <Video className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-zinc-200">{file.name}</p>
                      <p className="mt-1 text-xs text-zinc-500">{file.size}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setLocalUploads((prev) => prev.filter((item) => item.id !== file.id))}
                      className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-zinc-600 hover:bg-zinc-800"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setActiveTab('library')}
                className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm font-medium text-zinc-200 transition hover:border-zinc-600 hover:bg-zinc-800"
              >
                Back to Library
              </button>
              <button
                type="button"
                onClick={onNext}
                className="rounded-xl gradient-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
              >
                Continue to Product Brief
              </button>
            </div>
          </div>
        )}
      </div>
    </StepPanel>
  );
}

function ProductBriefStep({
  draft,
  onChange,
}: {
  draft: ProductBriefDraft;
  onChange: (next: ProductBriefDraft) => void;
}) {
  return (
    <div className="space-y-6">
      <StepPanel
        eyebrow="Step 02"
        title="Shape the product brief before generating"
        description="This step now follows the structured product-info layout from your frontend reference. The duplicate legacy text composer has been removed from this stage."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-zinc-300">Product name</span>
            <input
              value={draft.productName}
              onChange={(event) => onChange({ ...draft, productName: event.target.value })}
              placeholder="e.g. GlowBoost Vitamin C Serum"
              className="w-full rounded-2xl border border-zinc-700 bg-zinc-900/80 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition focus:border-blue-400/40"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-zinc-300">Target audience</span>
            <input
              value={draft.targetAudience}
              onChange={(event) => onChange({ ...draft, targetAudience: event.target.value })}
              placeholder="e.g. skincare buyers 25-40"
              className="w-full rounded-2xl border border-zinc-700 bg-zinc-900/80 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition focus:border-blue-400/40"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-sm font-medium text-zinc-300">Product description</span>
            <textarea
              value={draft.productDescription}
              onChange={(event) => onChange({ ...draft, productDescription: event.target.value })}
              placeholder="Describe what it does, what makes it different, and why it matters."
              rows={4}
              className="w-full rounded-2xl border border-zinc-700 bg-zinc-900/80 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition focus:border-blue-400/40"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-sm font-medium text-zinc-300">Key selling points</span>
            <textarea
              value={draft.sellingPoints}
              onChange={(event) => onChange({ ...draft, sellingPoints: event.target.value })}
              placeholder="List the strongest benefits, claims, proof points, or promo angles."
              rows={3}
              className="w-full rounded-2xl border border-zinc-700 bg-zinc-900/80 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition focus:border-blue-400/40"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-sm font-medium text-zinc-300">Product URL</span>
            <input
              value={draft.productUrl}
              onChange={(event) => onChange({ ...draft, productUrl: event.target.value })}
              placeholder="https://yourstore.com/products/..."
              className="w-full rounded-2xl border border-zinc-700 bg-zinc-900/80 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition focus:border-blue-400/40"
            />
          </label>
        </div>
        <div className="mt-6 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-5">
          <p className="text-sm font-semibold text-white">What happens next</p>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            Continue through Settings, Scripts, and Render from the top wizard. This phase keeps the new structured brief surface separate from the old create composer.
          </p>
        </div>
      </StepPanel>
    </div>
  );
}

function SettingsStep({
  draft,
  onChange,
  onBack,
  onNext,
}: {
  draft: SettingsDraft;
  onChange: (next: SettingsDraft) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <StepPanel
      eyebrow="Step 03"
      title="Tune generation settings"
      description="This step now behaves like a real settings editor instead of a placeholder card. It follows the structure of your frontend settings step while staying local to the homepage wizard for now."
    >
      <div className="space-y-5">
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/80 p-5">
          <div className="mb-4 flex items-center gap-2">
            <Monitor className="h-4 w-4 text-blue-300" />
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-300">Aspect Ratio</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {ASPECT_RATIOS.map(({ value, label, desc, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => onChange({ ...draft, aspectRatio: value })}
                className={`rounded-2xl border p-4 text-center transition ${
                  draft.aspectRatio === value
                    ? 'border-blue-400/40 bg-blue-500/10 text-white'
                    : 'border-zinc-700 bg-zinc-950/60 text-zinc-300 hover:border-zinc-600'
                }`}
              >
                <Icon className={`mx-auto h-5 w-5 ${draft.aspectRatio === value ? 'text-blue-200' : 'text-zinc-500'}`} />
                <p className="mt-3 text-sm font-semibold">{label}</p>
                <p className="mt-1 text-xs text-zinc-500">{desc}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/80 p-5">
          <div className="mb-4 flex items-center gap-2">
            <Clock3 className="h-4 w-4 text-blue-300" />
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-300">Duration</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {DURATIONS.map(({ value, label, desc }) => (
              <button
                key={value}
                type="button"
                onClick={() => onChange({ ...draft, duration: value })}
                className={`rounded-2xl border p-4 text-center transition ${
                  draft.duration === value
                    ? 'border-blue-400/40 bg-blue-500/10 text-white'
                    : 'border-zinc-700 bg-zinc-950/60 text-zinc-300 hover:border-zinc-600'
                }`}
              >
                <p className="text-2xl font-semibold">{label}</p>
                <p className="mt-1 text-xs text-zinc-500">{desc}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-3xl border border-zinc-800 bg-zinc-900/80 p-5">
            <div className="mb-4 flex items-center gap-2">
              <Globe2 className="h-4 w-4 text-blue-300" />
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-300">Language</p>
            </div>
            <div className="space-y-3">
              {LANGUAGES.map(({ value, label, flag }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => onChange({ ...draft, language: value })}
                  className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${
                    draft.language === value
                      ? 'border-blue-400/40 bg-blue-500/10'
                      : 'border-zinc-700 bg-zinc-950/60 hover:border-zinc-600'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold tracking-[0.18em] text-zinc-500">{flag}</span>
                    <span className="text-sm font-medium text-zinc-200">{label}</span>
                  </div>
                  {draft.language === value ? <Check className="h-4 w-4 text-blue-200" /> : null}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-zinc-800 bg-zinc-900/80 p-5">
            <div className="mb-4 flex items-center gap-2">
              <Mic className="h-4 w-4 text-blue-300" />
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-300">Voiceover</p>
            </div>
            <div className="space-y-3">
              {VOICES.map(({ value, label, desc }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => onChange({ ...draft, voice: value })}
                  className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${
                    draft.voice === value
                      ? 'border-blue-400/40 bg-blue-500/10'
                      : 'border-zinc-700 bg-zinc-950/60 hover:border-zinc-600'
                  }`}
                >
                  <div>
                    <p className="text-sm font-medium text-zinc-200">{label}</p>
                    <p className="mt-1 text-xs text-zinc-500">{desc}</p>
                  </div>
                  {draft.voice === value ? <Check className="h-4 w-4 text-blue-200" /> : null}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/80 p-5">
          <div className="mb-4 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-blue-300" />
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-300">Background Music</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {MUSIC_OPTIONS.map(({ value, label, desc }) => (
              <button
                key={value}
                type="button"
                onClick={() => onChange({ ...draft, music: value })}
                className={`rounded-2xl border px-4 py-4 text-left transition ${
                  draft.music === value
                    ? 'border-blue-400/40 bg-blue-500/10'
                    : 'border-zinc-700 bg-zinc-950/60 hover:border-zinc-600'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-zinc-200">{label}</p>
                    <p className="mt-1 text-xs text-zinc-500">{desc}</p>
                  </div>
                  {draft.music === value ? <Check className="mt-0.5 h-4 w-4 text-blue-200" /> : null}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm font-medium text-zinc-200 transition hover:border-zinc-600 hover:bg-zinc-800"
        >
          Back to Product Brief
        </button>
        <button
          type="button"
          onClick={onNext}
          className="rounded-xl gradient-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
        >
          Continue to Scripts
        </button>
      </div>
    </StepPanel>
  );
}

function ScriptsStep({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  return (
    <StepPanel
      eyebrow="Step 04"
      title="Prepare script generation"
      description="Script generation still runs through the current create-project path. This step now has its own editing surface instead of duplicating labels inside the brief area."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/80 p-5">
          <p className="text-sm font-semibold text-white">Idea mode</p>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            Start from a product angle or campaign concept and let Sprokl expand it into a script.
          </p>
        </div>
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/80 p-5">
          <p className="text-sm font-semibold text-white">Script mode</p>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            Paste an exact script when you already know the lines and want the video generated from that copy.
          </p>
        </div>
      </div>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm font-medium text-zinc-200 transition hover:border-zinc-600 hover:bg-zinc-800"
        >
          Back to Settings
        </button>
        <button
          type="button"
          onClick={onNext}
          className="rounded-xl gradient-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
        >
          Continue to Render
        </button>
      </div>
    </StepPanel>
  );
}

function RenderStep({ onBack, onGoBrief }: { onBack: () => void; onGoBrief: () => void }) {
  return (
    <StepPanel
      eyebrow="Step 05"
      title="Review and create the project"
      description="The current backend still reviews the final task on the confirmation page after creation. This stage keeps that path, but now the wizard flow above clearly leads here."
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/80 p-5">
          <p className="text-sm font-semibold text-white">Draft</p>
          <p className="mt-2 text-sm leading-6 text-zinc-400">Your brief is stored locally before the confirmation step.</p>
        </div>
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/80 p-5">
          <p className="text-sm font-semibold text-white">Review</p>
          <p className="mt-2 text-sm leading-6 text-zinc-400">You confirm voices, languages, and script mode using the existing flow.</p>
        </div>
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/80 p-5">
          <p className="text-sm font-semibold text-white">Create</p>
          <p className="mt-2 text-sm leading-6 text-zinc-400">Project creation continues into the current rendering and publishing pipeline.</p>
        </div>
      </div>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm font-medium text-zinc-200 transition hover:border-zinc-600 hover:bg-zinc-800"
        >
          Back to Scripts
        </button>
        <button
          type="button"
          onClick={onGoBrief}
          className="rounded-xl gradient-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
        >
          Go to the working creator
        </button>
      </div>
    </StepPanel>
  );
}

export function CreateVideoTaskShell() {
  const [currentStep, setCurrentStep] = useState<StepId>(1);
  const [productBriefDraft, setProductBriefDraft] = useState<ProductBriefDraft>({
    productName: '',
    productDescription: '',
    sellingPoints: '',
    targetAudience: '',
    productUrl: '',
  });
  const [settingsDraft, setSettingsDraft] = useState<SettingsDraft>({
    aspectRatio: '9:16',
    duration: 30,
    language: 'en',
    voice: 'nova-female',
    music: 'upbeat-trending',
  });

  return (
    <div className="-m-4 min-h-[calc(100vh-65px)] overflow-hidden bg-zinc-950 text-zinc-100 sm:-m-6">
      <div className="absolute inset-0 hero-grid opacity-35" />
      <div className="absolute inset-x-0 top-0 h-56 bg-[radial-gradient(circle_at_top,rgba(96,165,250,0.24),transparent_60%)]" />

      <div className="relative mx-auto min-h-[calc(100vh-65px)] max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            Build short video ads from product inputs
          </h1>
          <p className="mx-auto mt-3 max-w-3xl text-sm leading-6 text-zinc-400 sm:text-base">
            Start from your media, define the product brief, adjust the generation settings, and keep the current Sprokl creation flow intact.
          </p>
        </div>

        <div className="space-y-6">
          <WizardProgress currentStep={currentStep} onSelect={setCurrentStep} />

          {currentStep === 1 ? <MediaStep onNext={() => setCurrentStep(2)} /> : null}

          {currentStep === 2 ? <ProductBriefStep draft={productBriefDraft} onChange={setProductBriefDraft} /> : null}

          {currentStep === 3 ? (
            <SettingsStep
              draft={settingsDraft}
              onChange={setSettingsDraft}
              onBack={() => setCurrentStep(2)}
              onNext={() => setCurrentStep(4)}
            />
          ) : null}

          {currentStep === 4 ? <ScriptsStep onBack={() => setCurrentStep(3)} onNext={() => setCurrentStep(5)} /> : null}

          {currentStep === 5 ? <RenderStep onBack={() => setCurrentStep(4)} onGoBrief={() => setCurrentStep(2)} /> : null}
        </div>
      </div>
    </div>
  );
}
