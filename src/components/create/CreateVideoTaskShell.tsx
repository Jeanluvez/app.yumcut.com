"use client";

import Link from 'next/link';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  Check,
  Clock3,
  Edit3,
  FolderOpen,
  Globe2,
  Image as ImageIcon,
  Loader2,
  Monitor,
  PlayCircle,
  RefreshCw,
  RotateCcw,
  Square,
  Smartphone,
  Sparkles,
  Upload,
  Video,
  Mic,
} from 'lucide-react';
import { Api } from '@/lib/api-client';
import { Tooltip } from '@/components/common/Tooltip';
import { MediaThumbnail } from '@/components/media/MediaThumbnail';
import { toast } from 'sonner';

const PENDING_PROJECT_STORAGE_KEY = 'sprokl:pending-project-preview';

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
  file: File;
  assetId?: string;
};

type SampleProductBrief = Pick<
  ProductBriefDraft,
  'productName' | 'productDescription' | 'sellingPoints' | 'targetAudience'
>;

function countWords(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean).length;
}

function validateProductBriefDraft(draft: ProductBriefDraft) {
  if (
    !draft.productName.trim() ||
    !draft.productDescription.trim() ||
    !draft.sellingPoints.trim() ||
    !draft.targetAudience.trim()
  ) {
    return 'Complete all required product details before continuing.';
  }
  if (countWords(draft.productDescription) < 10 || countWords(draft.sellingPoints) < 10) {
    return 'Product description and key selling points must each be at least 10 words.';
  }
  return null;
}

function parseSampleProductBrief(markdown: string): SampleProductBrief {
  const normalized = markdown.replace(/\r\n/g, '\n');

  function extractSection(label: string) {
    const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = normalized.match(new RegExp(`${escapedLabel}:\\n([\\s\\S]*?)(?:\\n\\n[A-Za-z][^\\n]*:|$)`));
    if (!match) return '';

    return match[1]
      .split('\n')
      .map((line) => line.replace(/^\*\s*/, '').trim())
      .filter(Boolean)
      .join(' ');
  }

  return {
    productName: extractSection('Name'),
    productDescription: extractSection('Description'),
    sellingPoints: extractSection('Key Selling Points'),
    targetAudience: extractSection('Target Audience'),
  };
}

type ProductBriefDraft = {
  productName: string;
  productDescription: string;
  sellingPoints: string;
  targetAudience: string;
  productUrl: string;
  promotionalPricingEnabled: boolean;
  originalPrice: string;
  salePrice: string;
  promoDescription: string;
};

type SettingsDraft = {
  aspectRatio: '9:16' | '1:1' | '16:9';
  duration: 30 | 60 | 90;
  language: 'en' | 'es';
  voice: 'nova-female' | 'echo-male' | 'alloy-neutral';
  music: 'upbeat-trending' | 'chill-lofi' | 'dramatic-cinematic' | 'none';
};

type ScriptStyle = 'Storytelling' | 'Problem-Solution' | 'FOMO';

type ScriptDraft = {
  id: string;
  style: ScriptStyle;
  hook: string;
  body: string;
  cta: string;
  originalHook: string;
  originalBody: string;
  originalCta: string;
  edited?: boolean;
};

const STEPS = [
  {
    id: 1 as StepId,
    label: 'Media',
  },
  {
    id: 2 as StepId,
    label: 'Product Details',
  },
  {
    id: 3 as StepId,
    label: 'Video Settings',
  },
  {
    id: 4 as StepId,
    label: 'Scripts',
  },
  {
    id: 5 as StepId,
    label: 'Review & Render',
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

const SCRIPT_STYLE_STYLES: Record<ScriptStyle, string> = {
  Storytelling: 'border-violet-500/30 bg-violet-500/10 text-violet-200',
  'Problem-Solution': 'border-blue-500/30 bg-blue-500/10 text-blue-200',
  FOMO: 'border-pink-500/30 bg-pink-500/10 text-pink-200',
};

type GeneratedScriptApiItem = {
  id: string;
  styleLabel: string;
  hookText: string;
  bodyText: string;
  ctaText: string;
  isSelected: boolean;
};

function mapGeneratedScripts(items: GeneratedScriptApiItem[]): ScriptDraft[] {
  return items.map((item) => ({
    id: item.id,
    style: item.styleLabel as ScriptStyle,
    hook: item.hookText,
    body: item.bodyText,
    cta: item.ctaText,
    originalHook: item.hookText,
    originalBody: item.bodyText,
    originalCta: item.ctaText,
  }));
}

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
    <div className="rounded-[28px] border border-white/8 bg-black/20 px-4 py-4 sm:px-6">
      <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.24em] text-blue-200/80">Create Video Task</div>

      <div className="relative mb-4 h-px bg-zinc-800">
        <div
          className="gradient-primary absolute left-0 top-0 h-full transition-all duration-300"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-5">
        {STEPS.map(({ id, label }) => {
          const isActive = currentStep === id;
          const isCompleted = id < currentStep;

          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelect(id)}
              className="rounded-2xl px-2 py-2 text-left transition-all duration-200"
            >
              <div className="flex flex-col items-center gap-3 text-center">
                <div
                  className={[
                    'flex h-8 w-8 items-center justify-center rounded-full border text-sm font-semibold',
                    isActive
                      ? 'border-violet-400/50 bg-violet-500/15 text-violet-200'
                      : isCompleted
                        ? 'border-zinc-600 bg-zinc-800 text-zinc-100'
                        : 'border-zinc-700 bg-zinc-900 text-zinc-500',
                  ].join(' ')}
                >
                  {id}
                </div>
                <p className={['text-xs font-medium leading-5', isActive ? 'text-white' : 'text-zinc-500'].join(' ')}>
                  {label}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StepPanel({
  eyebrow,
  description,
  headerActions,
  children,
}: {
  eyebrow: string;
  description: string;
  headerActions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="rounded-[28px] border border-white/8 bg-zinc-950/75 p-5 shadow-[0_24px_80px_rgba(15,23,42,0.38)] sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <p className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.24em] text-blue-200/80">{eyebrow}</p>
          <p className="text-[11px] font-semibold text-zinc-500">{description}</p>
        </div>
        {headerActions ? <div className="shrink-0">{headerActions}</div> : null}
      </div>
      {children}
    </div>
  );
}

function InlinePagination({
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
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/60 px-4 py-3">
      <div className="text-xs font-medium text-zinc-500">
        Page {page} of {totalPages}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs font-medium text-zinc-200 transition hover:border-zinc-600 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Previous
        </button>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs font-medium text-zinc-200 transition hover:border-zinc-600 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}

function MediaStep({
  selectedIds,
  localUploads,
  selectedCount,
  isLoadingSample,
  onLoadSample,
  onChangeSelectedIds,
  onChangeLocalUploads,
  onRemoveLocalUpload,
  onNext,
}: {
  selectedIds: string[];
  localUploads: LocalUploadItem[];
  selectedCount: number;
  isLoadingSample: boolean;
  onLoadSample: () => void;
  onChangeSelectedIds: (next: string[]) => void;
  onChangeLocalUploads: (next: LocalUploadItem[]) => void;
  onRemoveLocalUpload: (id: string, assetId?: string) => void;
  onNext: () => void;
}) {
  const [activeTab, setActiveTab] = useState<'library' | 'upload'>('upload');
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [libraryPage, setLibraryPage] = useState(1);
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

  const libraryAssets = assets.filter((item) => item.type !== 'hook');
  const totalLibraryPages = Math.max(1, Math.ceil(libraryAssets.length / 9));
  const paginatedLibraryAssets = libraryAssets.slice((libraryPage - 1) * 9, (libraryPage - 1) * 9 + 9);
  const canContinue = selectedIds.length + localUploads.length >= 1;

  useEffect(() => {
    if (activeTab !== 'library') return;
    if (libraryPage > totalLibraryPages) {
      setLibraryPage(totalLibraryPages);
    }
  }, [activeTab, libraryPage, totalLibraryPages]);

  useEffect(() => {
    if (activeTab === 'library') {
      setLibraryPage(1);
    }
  }, [activeTab]);

  function toggleAsset(id: string) {
    onChangeSelectedIds(selectedIds.includes(id) ? selectedIds.filter((item) => item !== id) : [...selectedIds, id]);
  }

  function handleLocalFiles(files: FileList | null) {
    if (!files?.length) return;

    const nextFiles = Array.from(files).map((file, index) => ({
      id: `${file.name}-${file.size}-${Date.now()}-${index}`,
      name: file.name,
      size: formatBytes(String(file.size)),
      kind: file.type.startsWith('video') ? 'video' : 'image',
      file,
    } as LocalUploadItem));

    onChangeLocalUploads([...localUploads, ...nextFiles]);
  }

  return (
    <StepPanel
      eyebrow="Step 01"
      description="Choose the media files that will be used in this video."
    >
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex w-fit items-center rounded-xl border border-zinc-800 bg-zinc-900 p-1">
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
            <button
              type="button"
              onClick={() => setActiveTab('library')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                activeTab === 'library' ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <FolderOpen className="h-4 w-4" />
              My Assets ({assets.length})
            </button>
          </div>
          <div className="ml-auto flex flex-col items-end gap-2">
            <Tooltip
              content="Instantly load demo media and pre-filled product details so you can explore the full workflow faster."
              side="bottom"
              align="end"
            >
              <button
                type="button"
                onClick={() => {
                  setActiveTab('upload');
                  onLoadSample();
                }}
                disabled={isLoadingSample}
                className="inline-flex items-center gap-2 rounded-xl border border-blue-400/20 bg-blue-500/10 px-3 py-2 text-xs font-semibold text-blue-100 transition hover:border-blue-300/30 hover:bg-blue-500/15 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoadingSample ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                <span>{isLoadingSample ? 'Loading sample...' : 'Try a Sample Setup'}</span>
              </button>
            </Tooltip>
            <div className="hidden items-center justify-end gap-4 text-xs sm:flex">
              <span className="text-zinc-500">
                <span className="font-semibold text-blue-300">{localUploads.length}</span> local files
              </span>
              <span className="text-zinc-500">
                <span className="font-semibold text-blue-300">{selectedCount}</span> selected assets
              </span>
            </div>
          </div>
        </div>

        {activeTab === 'library' ? (
          <div className="space-y-5">
            {loading ? (
              <div className="flex min-h-[220px] items-center justify-center rounded-3xl border border-zinc-800 bg-zinc-900/60">
                <div className="flex items-center gap-2 text-sm text-zinc-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading asset library
                </div>
              </div>
            ) : libraryAssets.length > 0 ? (
              <>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {paginatedLibraryAssets.map((asset) => {
                  const isSelected = selectedIds.includes(asset.id);
                  const isVideo = asset.mimeType.startsWith('video') || asset.type === 'video';
                  const previewUrl = asset.thumbnailUrl || asset.storageUrl;

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
                          <MediaThumbnail
                            kind={isVideo ? 'video' : 'image'}
                            src={isVideo ? asset.storageUrl : previewUrl}
                            poster={isVideo ? asset.thumbnailUrl : null}
                            alt={asset.filename}
                            className="h-full w-full object-cover"
                            iconClassName="h-6 w-6 text-zinc-600"
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
              <InlinePagination page={libraryPage} totalPages={totalLibraryPages} onPageChange={setLibraryPage} />
              </>
            ) : (
              <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-8 text-center">
                <p className="text-base font-semibold text-white">No media assets yet</p>
                <p className="mt-2 text-sm leading-6 text-zinc-400">
                  Use the existing workspace upload flow first, then come back to start this wizard from your library.
                </p>
                <Link
                  href="/workspace/assets"
                  className="mt-4 inline-flex rounded-xl border border-blue-400/20 bg-blue-500/10 px-4 py-2.5 text-sm font-medium text-blue-100 transition hover:bg-blue-500/15"
                >
                  Open My Assets
                </Link>
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="button"
                onClick={onNext}
                disabled={!canContinue}
                className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                  canContinue
                    ? 'gradient-primary text-white hover:opacity-90'
                    : 'cursor-not-allowed border border-zinc-800 bg-zinc-900 text-zinc-500'
                }`}
              >
                Continue to Product Details
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-3xl border-2 border-dashed border-zinc-700 bg-zinc-900/60 p-8 text-center">
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
                Choose local video clips or product images first.
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
                      <p className="mt-1 text-[11px] text-zinc-600">
                        {file.assetId ? 'Uploaded to draft project' : 'Pending upload'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemoveLocalUpload(file.id, file.assetId)}
                      className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-zinc-600 hover:bg-zinc-800"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-3">
              <div className="ml-auto flex flex-wrap items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onNext}
                  disabled={!canContinue}
                  className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                    canContinue
                      ? 'gradient-primary text-white hover:opacity-90'
                      : 'cursor-not-allowed border border-zinc-800 bg-zinc-900 text-zinc-500'
                  }`}
                >
                  Continue to Product Details
                </button>
              </div>
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
  onBack,
  onNext,
}: {
  draft: ProductBriefDraft;
  onChange: (next: ProductBriefDraft) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const validationError = validateProductBriefDraft(draft);
  const canContinue = !validationError;

  return (
    <div className="space-y-6">
    <StepPanel
      eyebrow="Step 02"
      description="Add the core product details needed to generate scripts."
    >
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-zinc-300">Product name *</span>
            <input
              value={draft.productName}
              onChange={(event) => onChange({ ...draft, productName: event.target.value })}
              placeholder="e.g. GlowBoost Vitamin C Serum"
              className="w-full rounded-2xl border border-zinc-700 bg-zinc-900/80 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition focus:border-blue-400/40"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-zinc-300">Target audience *</span>
            <input
              value={draft.targetAudience}
              onChange={(event) => onChange({ ...draft, targetAudience: event.target.value })}
              placeholder="e.g. skincare buyers 25-40"
              className="w-full rounded-2xl border border-zinc-700 bg-zinc-900/80 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition focus:border-blue-400/40"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-sm font-medium text-zinc-300">Product description *</span>
            <textarea
              value={draft.productDescription}
              onChange={(event) => onChange({ ...draft, productDescription: event.target.value })}
              placeholder="Describe what it does, what makes it different, and why it matters."
              rows={4}
              className="w-full rounded-2xl border border-zinc-700 bg-zinc-900/80 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition focus:border-blue-400/40"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-sm font-medium text-zinc-300">Key selling points *</span>
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

        <div className="mt-5 rounded-3xl border border-zinc-800 bg-zinc-900/80">
          <div className="flex items-center justify-between gap-4 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${draft.promotionalPricingEnabled ? 'bg-pink-500/15 text-pink-300' : 'bg-zinc-800 text-zinc-500'}`}>
                %
              </div>
              <div>
                <div className="text-base font-medium text-zinc-100">Promotional pricing</div>
                <div className="mt-1 text-sm text-zinc-500">Add sale price and discount info to the script</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onChange({ ...draft, promotionalPricingEnabled: !draft.promotionalPricingEnabled })}
              className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition ${draft.promotionalPricingEnabled ? 'bg-violet-500' : 'bg-zinc-700'}`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${draft.promotionalPricingEnabled ? 'translate-x-6' : 'translate-x-1'}`}
              />
            </button>
          </div>

          {draft.promotionalPricingEnabled ? (
            <div className="border-t border-zinc-800 px-5 py-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-zinc-300">Original price</span>
                  <input
                    value={draft.originalPrice}
                    onChange={(event) => onChange({ ...draft, originalPrice: event.target.value })}
                    placeholder="$ 49.99"
                    className="w-full rounded-2xl border border-zinc-700 bg-zinc-900/80 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition focus:border-blue-400/40"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-zinc-300">Sale price</span>
                  <input
                    value={draft.salePrice}
                    onChange={(event) => onChange({ ...draft, salePrice: event.target.value })}
                    placeholder="$ 29.99"
                    className="w-full rounded-2xl border border-zinc-700 bg-zinc-900/80 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition focus:border-blue-400/40"
                  />
                </label>
                <label className="block sm:col-span-2">
                  <span className="mb-1.5 block text-sm font-medium text-zinc-300">Promo description (optional)</span>
                  <input
                    value={draft.promoDescription}
                    onChange={(event) => onChange({ ...draft, promoDescription: event.target.value })}
                    placeholder="e.g. Flash sale ends Sunday · Use code GLOW20 at checkout"
                    className="w-full rounded-2xl border border-zinc-700 bg-zinc-900/80 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition focus:border-blue-400/40"
                  />
                </label>
              </div>
            </div>
          ) : null}
        </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="ml-auto flex flex-wrap items-center justify-end gap-3">
          <button
            type="button"
            onClick={onBack}
            className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm font-medium text-zinc-200 transition hover:border-zinc-600 hover:bg-zinc-800"
          >
            Back to Media
          </button>
          <button
            type="button"
            onClick={() => {
              if (validationError) {
                toast.error(validationError);
                return;
              }
              onNext();
            }}
            disabled={!canContinue}
            className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
              canContinue
                ? 'gradient-primary text-white hover:opacity-90'
                : 'cursor-not-allowed border border-zinc-800 bg-zinc-900 text-zinc-500'
            }`}
          >
            Continue to Video Settings
          </button>
        </div>
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
  const canContinue = Boolean(draft.aspectRatio && draft.duration && draft.language && draft.voice && draft.music);

  return (
    <StepPanel
      eyebrow="Step 03"
      description="Choose the video settings for this render."
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
                className={`rounded-2xl border px-4 py-3 text-left transition ${
                  draft.aspectRatio === value
                    ? 'border-blue-400/40 bg-blue-500/10 text-white'
                    : 'border-zinc-700 bg-zinc-950/60 text-zinc-300 hover:border-zinc-600'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Icon className={`h-5 w-5 ${draft.aspectRatio === value ? 'text-blue-200' : 'text-zinc-500'}`} />
                    <div>
                      <p className="text-sm font-semibold">{label}</p>
                      <p className="mt-0.5 text-xs text-zinc-500">{desc}</p>
                    </div>
                  </div>
                  {draft.aspectRatio === value ? <Check className="h-4 w-4 text-blue-200" /> : null}
                </div>
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
                className={`rounded-2xl border px-4 py-3 text-left transition ${
                  draft.duration === value
                    ? 'border-blue-400/40 bg-blue-500/10 text-white'
                    : 'border-zinc-700 bg-zinc-950/60 text-zinc-300 hover:border-zinc-600'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{label}</p>
                    <p className="mt-0.5 text-xs text-zinc-500">{desc}</p>
                  </div>
                  {draft.duration === value ? <Check className="h-4 w-4 text-blue-200" /> : null}
                </div>
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
                  className={`flex w-full items-center justify-between rounded-2xl border px-4 py-2.5 text-left transition ${
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
                  className={`flex w-full items-center justify-between rounded-2xl border px-4 py-2.5 text-left transition ${
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
                className={`rounded-2xl border px-4 py-3 text-left transition ${
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
        <div className="ml-auto flex flex-wrap items-center justify-end gap-3">
          <button
            type="button"
            onClick={onBack}
            className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm font-medium text-zinc-200 transition hover:border-zinc-600 hover:bg-zinc-800"
          >
            Back to Product Details
          </button>
          <button
            type="button"
            onClick={onNext}
            disabled={!canContinue}
            className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
              canContinue
                ? 'gradient-primary text-white hover:opacity-90'
                : 'cursor-not-allowed border border-zinc-800 bg-zinc-900 text-zinc-500'
            }`}
          >
            Continue to Scripts
          </button>
        </div>
      </div>
    </StepPanel>
  );
}

function ScriptsStep({
  projectId,
  scripts,
  selectedIds,
  onChangeScripts,
  onChangeSelectedIds,
  onBack,
  onNext,
  isBootstrapping,
  scriptsLoadedForProjectId,
  onScriptsReady,
}: {
  projectId: string | null;
  scripts: ScriptDraft[];
  selectedIds: string[];
  onChangeScripts: (next: ScriptDraft[]) => void;
  onChangeSelectedIds: (next: string[]) => void;
  onBack: () => void;
  onNext: () => void;
  isBootstrapping: boolean;
  scriptsLoadedForProjectId: string | null;
  onScriptsReady: (projectId: string | null) => void;
}) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<ScriptDraft>>({});
  const autoGenerateProjectIdRef = useRef<string | null>(null);
  const isLoadingScripts =
    isBootstrapping || isGenerating || !projectId || scriptsLoadedForProjectId !== projectId || scripts.length === 0;
  const canContinue = !isLoadingScripts && selectedIds.length > 0;

  useEffect(() => {
    if (!projectId || scripts.length > 0) return;
    if (autoGenerateProjectIdRef.current === projectId) return;

    let cancelled = false;
    autoGenerateProjectIdRef.current = projectId;
    setIsGenerating(true);
    void (async () => {
      try {
        const generatedResult = (await Api.generateProjectScripts(projectId, { overwrite: true })) as {
          scripts?: GeneratedScriptApiItem[];
        };
        if (cancelled) return;
        const generatedScripts = mapGeneratedScripts(Array.isArray(generatedResult?.scripts) ? generatedResult.scripts : []);
        onChangeScripts(generatedScripts);
        onChangeSelectedIds(generatedScripts.map((item) => item.id));
        onScriptsReady(projectId);
      } catch (error: any) {
        if (!cancelled && autoGenerateProjectIdRef.current === projectId) {
          autoGenerateProjectIdRef.current = null;
        }
        const message = error?.error?.message || 'Failed to generate scripts.';
        toast.error(message);
      } finally {
        if (!cancelled) {
          setIsGenerating(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [projectId, scripts.length, onChangeScripts, onChangeSelectedIds, onScriptsReady]);

  function handleRegenerate() {
    if (!projectId) {
      toast.error('Project is not ready for script generation yet.');
      return;
    }
    autoGenerateProjectIdRef.current = projectId;
    setEditingId(null);
    setIsGenerating(true);
    void (async () => {
      try {
        const generatedResult = (await Api.generateProjectScripts(projectId, { overwrite: true })) as {
          scripts?: GeneratedScriptApiItem[];
        };
        const generatedScripts = mapGeneratedScripts(Array.isArray(generatedResult?.scripts) ? generatedResult.scripts : []);
        onChangeScripts(generatedScripts);
        onChangeSelectedIds(generatedScripts.map((item) => item.id));
        onScriptsReady(projectId);
      } catch (error: any) {
        const message = error?.error?.message || 'Failed to regenerate scripts.';
        toast.error(message);
      } finally {
        setIsGenerating(false);
      }
    })();
  }

  function toggleSelected(id: string) {
    onChangeSelectedIds(
      selectedIds.includes(id) ? selectedIds.filter((item) => item !== id) : [...selectedIds, id],
    );
  }

  function startEditing(script: ScriptDraft) {
    setEditingId(script.id);
    setEditDraft({ hook: script.hook, body: script.body, cta: script.cta });
  }

  function saveEdit(id: string) {
    onChangeScripts(
      scripts.map((item) =>
        item.id === id
          ? {
              ...item,
              hook: editDraft.hook ?? item.hook,
              body: editDraft.body ?? item.body,
              cta: editDraft.cta ?? item.cta,
              edited: true,
            }
          : item,
      ),
    );
    setEditingId(null);
  }

  function resetScript(id: string) {
    const replacement = scripts.find((item) => item.id === id);
    if (!replacement) return;
    onChangeScripts(
      scripts.map((item) =>
        item.id === id
          ? {
              ...item,
              hook: item.originalHook,
              body: item.originalBody,
              cta: item.originalCta,
              edited: false,
            }
          : item,
      ),
    );
    setEditingId(null);
  }

  return (
    <StepPanel
      eyebrow="Step 04"
      description="Choose and refine the script variants you want to render."
      headerActions={!isLoadingScripts ? (
        <button
          type="button"
          onClick={handleRegenerate}
          disabled={isGenerating}
          className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm font-medium text-zinc-200 transition hover:border-zinc-600 hover:bg-zinc-800 disabled:opacity-50"
        >
          <span className="inline-flex items-center gap-2">
            {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Regenerate
          </span>
        </button>
      ) : null}
    >
      {isLoadingScripts ? (
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 px-5 py-5">
          <div className="flex items-center gap-3 text-sm text-zinc-200">
            <Loader2 className="h-4 w-4 animate-spin text-blue-300" />
            <span>{isBootstrapping ? 'Preparing your script workspace.' : 'Your scripts are being generated.'}</span>
          </div>
          <div className="mt-2 text-sm text-zinc-500">
            {isBootstrapping
              ? 'We are creating the draft project and getting the script generation flow ready.'
              : 'This usually takes a few seconds while we prepare script variants from your product details.'}
          </div>
        </div>
      ) : null}

      {!isLoadingScripts ? (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <p className="text-xs text-zinc-500">
              <span className="font-semibold text-zinc-200">{selectedIds.length}</span> of {scripts.length} scripts selected
            </p>
            <button
              type="button"
              onClick={() =>
                onChangeSelectedIds(selectedIds.length === scripts.length ? [] : scripts.map((item) => item.id))
              }
              className="text-xs font-medium text-blue-200 transition hover:text-blue-100"
            >
              {selectedIds.length === scripts.length ? 'Deselect all' : 'Select all'}
            </button>
          </div>

          {scripts.map((script) => {
            const isSelected = selectedIds.includes(script.id);
            const isEditing = editingId === script.id;

            return (
              <div
                key={script.id}
                className={`rounded-3xl border bg-zinc-900/80 transition ${
                  isSelected ? 'border-blue-400/40 ring-1 ring-blue-400/20' : 'border-zinc-800'
                }`}
              >
                <div className="flex items-center justify-between gap-3 border-b border-zinc-800 px-5 py-4">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => toggleSelected(script.id)}
                      className={`flex h-5 w-5 items-center justify-center rounded-md border-2 transition ${
                        isSelected ? 'border-blue-400 bg-blue-500' : 'border-zinc-600 hover:border-zinc-500'
                      }`}
                    >
                      {isSelected ? <Check className="h-3 w-3 text-white" /> : null}
                    </button>
                    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${SCRIPT_STYLE_STYLES[script.style]}`}>
                      {script.style}
                    </span>
                    {script.edited ? (
                      <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-[10px] font-medium text-amber-300">
                        Edited
                      </span>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-2">
                    {script.edited ? (
                      <button
                        type="button"
                        onClick={() => resetScript(script.id)}
                        className="rounded-lg p-2 text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-200"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </button>
                    ) : null}
                    {!isEditing ? (
                      <button
                        type="button"
                        onClick={() => startEditing(script)}
                        className="rounded-lg p-2 text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-200"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-4 px-5 py-5">
                  <div>
                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">Hook</p>
                    {isEditing ? (
                      <textarea
                        rows={2}
                        value={editDraft.hook ?? ''}
                        onChange={(event) => setEditDraft((prev) => ({ ...prev, hook: event.target.value }))}
                        className="w-full rounded-2xl border border-zinc-700 bg-zinc-950/70 px-4 py-3 text-sm text-zinc-100 outline-none transition focus:border-blue-400/40"
                      />
                    ) : (
                      <p className="text-sm font-medium leading-6 text-zinc-100">{script.hook}</p>
                    )}
                  </div>

                  <div>
                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">Body</p>
                    {isEditing ? (
                      <textarea
                        rows={4}
                        value={editDraft.body ?? ''}
                        onChange={(event) => setEditDraft((prev) => ({ ...prev, body: event.target.value }))}
                        className="w-full rounded-2xl border border-zinc-700 bg-zinc-950/70 px-4 py-3 text-sm text-zinc-100 outline-none transition focus:border-blue-400/40"
                      />
                    ) : (
                      <p className="whitespace-pre-line text-sm leading-6 text-zinc-400">{script.body}</p>
                    )}
                  </div>

                  <div>
                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">CTA</p>
                    {isEditing ? (
                      <textarea
                        rows={2}
                        value={editDraft.cta ?? ''}
                        onChange={(event) => setEditDraft((prev) => ({ ...prev, cta: event.target.value }))}
                        className="w-full rounded-2xl border border-zinc-700 bg-zinc-950/70 px-4 py-3 text-sm text-zinc-100 outline-none transition focus:border-blue-400/40"
                      />
                    ) : (
                      <p className="text-sm leading-6 text-zinc-300">{script.cta}</p>
                    )}
                  </div>

                  {isEditing ? (
                    <div className="flex flex-wrap items-center gap-3 border-t border-zinc-800 pt-4">
                      <button
                        type="button"
                        onClick={() => saveEdit(script.id)}
                        className="rounded-xl gradient-primary px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
                      >
                        Save changes
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:border-zinc-600 hover:bg-zinc-800"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="ml-auto flex flex-wrap items-center justify-end gap-3">
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
            disabled={!canContinue}
            className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
              canContinue
                ? 'gradient-primary text-white hover:opacity-90'
                : 'cursor-not-allowed border border-zinc-800 bg-zinc-900 text-zinc-500'
            }`}
          >
            Continue to Review
          </button>
        </div>
      </div>
    </StepPanel>
  );
}

function RenderStep({
  productBrief,
  settings,
  scripts,
  selectedIds,
  selectedAssetCount,
  localUploadCount,
  showFreePlanWatermarkNotice,
  submitting,
  onCreate,
  onBack,
}: {
  productBrief: ProductBriefDraft;
  settings: SettingsDraft;
  scripts: ScriptDraft[];
  selectedIds: string[];
  selectedAssetCount: number;
  localUploadCount: number;
  showFreePlanWatermarkNotice: boolean;
  submitting: boolean;
  onCreate: () => void;
  onBack: () => void;
}) {
  const selectedScripts = scripts.filter((item) => selectedIds.includes(item.id));
  const selectedLanguage = LANGUAGES.find((item) => item.value === settings.language);
  const selectedVoice = VOICES.find((item) => item.value === settings.voice);
  const selectedMusic = MUSIC_OPTIONS.find((item) => item.value === settings.music);
  const totalSelectedMediaCount = selectedAssetCount + localUploadCount;
  const canCreate = totalSelectedMediaCount >= 1 && selectedScripts.length > 0 && !submitting;

  return (
    <StepPanel
      eyebrow="Step 05"
      description="Review the details before starting rendering."
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/80 p-5">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
            <span className="text-violet-300">◌</span>
            <span>Product</span>
          </div>
          <div className="mt-4 text-2xl font-medium tracking-tight text-zinc-100">
            {productBrief.productName || 'Untitled product'}
          </div>
          <div className="mt-3 text-sm leading-7 text-zinc-500">
            {productBrief.productDescription || 'No product description added yet.'}
          </div>
          {productBrief.promotionalPricingEnabled ? (
            <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-950/80 px-4 py-3">
              <div className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">Promotional Pricing</div>
              <div className="mt-2 text-sm text-zinc-100">
                {productBrief.originalPrice ? `Original ${productBrief.originalPrice}` : 'Original price not set'}
                {' -> '}
                {productBrief.salePrice ? `Sale ${productBrief.salePrice}` : 'Sale price not set'}
              </div>
              {productBrief.promoDescription ? (
                <div className="mt-2 text-sm text-zinc-500">{productBrief.promoDescription}</div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/80 p-5">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
            <span className="text-violet-300">◌</span>
            <span>Video Settings</span>
          </div>
          <div className="mt-4 space-y-2.5 text-sm">
            <div className="flex items-center justify-between gap-4">
              <span className="text-zinc-500">Format</span>
              <span className="font-medium text-zinc-100">{settings.aspectRatio}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-zinc-500">Duration</span>
              <span className="font-medium text-zinc-100">{settings.duration}s</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-zinc-500">Language</span>
              <span className="font-medium text-zinc-100">{selectedLanguage?.label || settings.language.toUpperCase()}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-zinc-500">Voice</span>
              <span className="font-medium text-zinc-100">{selectedVoice?.label || settings.voice}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-zinc-500">Music</span>
              <span className="font-medium text-zinc-100">{selectedMusic?.label || settings.music}</span>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/80 p-5">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
            <span className="text-violet-300">◌</span>
            <span>Assets</span>
          </div>
          <div className="mt-4 text-2xl font-medium tracking-tight text-zinc-100">
            {totalSelectedMediaCount} media files selected
          </div>
          <div className="mt-3 text-sm leading-7 text-zinc-500">
            {totalSelectedMediaCount > 0
              ? `${selectedAssetCount} asset${selectedAssetCount === 1 ? '' : 's'} selected from your library and ${localUploadCount} local upload${localUploadCount === 1 ? '' : 's'} added for this render.`
              : 'No media files selected yet.'}
          </div>
        </div>

        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/80 p-5">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
            <span className="text-violet-300">◌</span>
            <span>Scripts To Render</span>
          </div>
          <div className="mt-4 space-y-3">
            {selectedScripts.length > 0 ? (
              selectedScripts.map((script) => (
                <div key={script.id} className="flex items-center gap-3 text-sm text-zinc-100">
                  <Check className="h-4 w-4 text-emerald-400" />
                  <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${SCRIPT_STYLE_STYLES[script.style]}`}>
                    {script.style}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-sm text-zinc-500">No scripts selected yet.</div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-3xl border border-zinc-800 bg-zinc-900/60 px-5 py-4">
        <div className="flex items-start gap-3">
          <Clock3 className="mt-0.5 h-4 w-4 text-zinc-500" />
          <div>
            <div className="text-sm text-zinc-100">
              Estimated rendering time: <span className="font-semibold">3-7 minutes</span> per video
            </div>
            <div className="mt-1 text-sm text-zinc-500">
              All selected variants render in parallel. You&apos;ll receive a browser notification when complete.
            </div>
          </div>
        </div>
      </div>

      {showFreePlanWatermarkNotice ? (
        <div className="mt-5 rounded-3xl border border-amber-500/30 bg-amber-500/10 px-5 py-4">
          <div className="text-sm font-medium text-amber-200">Free plan: Sprokl watermark included</div>
          <div className="mt-1 text-sm leading-6 text-amber-300/90">
            Videos on the Free plan include a Sprokl watermark in the bottom-right corner. Upgrade later to remove it.
          </div>
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="ml-auto flex flex-wrap items-center justify-end gap-3">
          <button
            type="button"
            onClick={onBack}
            className="rounded-2xl border border-zinc-700 bg-zinc-900 px-5 py-3 text-sm font-medium text-zinc-200 transition hover:border-zinc-600 hover:bg-zinc-800"
          >
            Back to Scripts
          </button>
          <button
            type="button"
            onClick={onCreate}
            disabled={!canCreate}
            className={`rounded-2xl px-6 py-3 text-sm font-semibold transition ${
              canCreate
                ? 'gradient-primary text-white hover:opacity-90'
                : 'cursor-not-allowed border border-zinc-800 bg-zinc-900 text-zinc-500'
            }`}
          >
            {submitting ? 'Starting render...' : 'Start Rendering'}
          </button>
        </div>
      </div>
    </StepPanel>
  );
}

export function CreateVideoTaskShell() {
  const router = useRouter();
  const draftProjectPromiseRef = useRef<Promise<string> | null>(null);
  const [currentStep, setCurrentStep] = useState<StepId>(1);
  const [draftProjectId, setDraftProjectId] = useState<string | null>(null);
  const [bootstrappingProject, setBootstrappingProject] = useState(false);
  const [productBriefDraft, setProductBriefDraft] = useState<ProductBriefDraft>({
    productName: '',
    productDescription: '',
    sellingPoints: '',
    targetAudience: '',
    productUrl: '',
    promotionalPricingEnabled: false,
    originalPrice: '',
    salePrice: '',
    promoDescription: '',
  });
  const [settingsDraft, setSettingsDraft] = useState<SettingsDraft>({
    aspectRatio: '9:16',
    duration: 30,
    language: 'en',
    voice: 'nova-female',
    music: 'upbeat-trending',
  });
  const [scriptDrafts, setScriptDrafts] = useState<ScriptDraft[]>([]);
  const [selectedScriptIds, setSelectedScriptIds] = useState<string[]>([]);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [localUploadDrafts, setLocalUploadDrafts] = useState<LocalUploadItem[]>([]);
  const [submittingRender, setSubmittingRender] = useState(false);
  const [scriptsLoadedForProjectId, setScriptsLoadedForProjectId] = useState<string | null>(null);
  const [showFreePlanWatermarkNotice, setShowFreePlanWatermarkNotice] = useState(true);
  const [loadingSampleSetup, setLoadingSampleSetup] = useState(false);

  const selectedMediaCount = selectedAssetIds.length + localUploadDrafts.length;

  useEffect(() => {
    let cancelled = false;

    void Api.getAssetSummary()
      .then((summary) => {
        if (cancelled) return;
        setShowFreePlanWatermarkNotice(summary.plan === 'free');
      })
      .catch(() => {
        if (cancelled) return;
        setShowFreePlanWatermarkNotice(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function createDraftProjectIfNeeded() {
    if (draftProjectId) return draftProjectId;
    if (draftProjectPromiseRef.current) return draftProjectPromiseRef.current;

    draftProjectPromiseRef.current = (async () => {
      const created = await Api.createProject({
        name: productBriefDraft.productName.trim().slice(0, 120),
        productName: productBriefDraft.productName.trim(),
        productDescription: productBriefDraft.productDescription.trim(),
        sellingPoints: productBriefDraft.sellingPoints.trim(),
        targetAudience: productBriefDraft.targetAudience.trim(),
        durationSeconds: settingsDraft.duration,
        language: settingsDraft.language,
        aspectRatio:
          settingsDraft.aspectRatio === '9:16'
            ? 'vertical_9_16'
            : settingsDraft.aspectRatio === '1:1'
              ? 'square_1_1'
              : 'landscape_16_9',
      });

      setDraftProjectId(created.id);

      if (productBriefDraft.promotionalPricingEnabled) {
        await Api.updateProject(created.id, {
          promoEnabled: true,
          promoInfo: {
            originalPrice: productBriefDraft.originalPrice.trim(),
            salePrice: productBriefDraft.salePrice.trim(),
            discountLabel: productBriefDraft.promoDescription.trim(),
          },
        });
      }

      return created.id;
    })();

    try {
      return await draftProjectPromiseRef.current;
    } catch (error) {
      draftProjectPromiseRef.current = null;
      throw error;
    }
  }

  async function uploadPendingLocalFiles(projectId: string) {
    const pendingFiles = localUploadDrafts.filter((item) => !item.assetId);
    if (pendingFiles.length === 0) return [];

    const uploadedAssetIds: string[] = [];
    for (const item of pendingFiles) {
      const uploaded = await Api.uploadAsset(projectId, item.file, item.kind);
      uploadedAssetIds.push(uploaded.id);
      setLocalUploadDrafts((prev) =>
        prev.map((entry) => (entry.id === item.id ? { ...entry, assetId: uploaded.id } : entry)),
      );
    }

    return uploadedAssetIds;
  }

  function validateStep(step: StepId) {
    if (step === 1) {
      if (selectedMediaCount < 1) {
        toast.error('Select at least 1 media file before continuing.');
        return false;
      }
      return true;
    }

    if (step === 2) {
      const errorMessage = validateProductBriefDraft(productBriefDraft);
      if (errorMessage) {
        toast.error(errorMessage);
        return false;
      }
      return true;
    }

    if (step === 3) {
      if (!settingsDraft.aspectRatio || !settingsDraft.duration || !settingsDraft.language || !settingsDraft.voice || !settingsDraft.music) {
        toast.error('Complete all video settings before continuing.');
        return false;
      }
      return true;
    }

    if (step === 4) {
      if (selectedScriptIds.length < 1) {
        toast.error('Select at least 1 script before continuing.');
        return false;
      }
      return true;
    }

    return true;
  }

  function removeLocalUpload(id: string, assetId?: string) {
    setLocalUploadDrafts((prev) => prev.filter((item) => item.id !== id));
    if (assetId) {
      setSelectedAssetIds((prev) => prev.filter((item) => item !== assetId));
    }
  }

  async function loadSampleSetup() {
    if (loadingSampleSetup) return;

    setLoadingSampleSetup(true);
    try {
      const sampleDefinitions = [
        { url: '/characters/rhode1.png', filename: 'test1.png', kind: 'image' as const, mimeType: 'image/png' },
        { url: '/characters/rhode2.mp4', filename: 'test2.mp4', kind: 'video' as const, mimeType: 'video/mp4' },
        { url: '/characters/rhode4.mp4', filename: 'test3.mp4', kind: 'video' as const, mimeType: 'video/mp4' },
      ];

      const [sampleFiles, sampleBriefResponse] = await Promise.all([
        Promise.all(
          sampleDefinitions.map(async (sample, index) => {
            const response = await fetch(sample.url);
            if (!response.ok) {
              throw new Error(`Could not load ${sample.filename}`);
            }
            const blob = await response.blob();
            const file = new File([blob], sample.filename, {
              type: blob.type || sample.mimeType,
            });

            return {
              id: `sample-${index + 1}`,
              name: sample.filename,
              size: formatBytes(String(file.size)),
              kind: sample.kind,
              file,
            } as LocalUploadItem;
          }),
        ),
        fetch('/characters/rhode-test.md'),
      ]);

      if (!sampleBriefResponse.ok) {
        throw new Error('Could not load sample product details');
      }

      const sampleBriefMarkdown = await sampleBriefResponse.text();
      const parsedBrief = parseSampleProductBrief(sampleBriefMarkdown);

      draftProjectPromiseRef.current = null;
      setDraftProjectId(null);
      setScriptDrafts([]);
      setSelectedScriptIds([]);
      setScriptsLoadedForProjectId(null);
      setLocalUploadDrafts(sampleFiles);
      setSelectedAssetIds([]);
      setProductBriefDraft((prev) => ({
        ...prev,
        productName: parsedBrief.productName,
        productDescription: parsedBrief.productDescription,
        sellingPoints: parsedBrief.sellingPoints,
        targetAudience: parsedBrief.targetAudience,
      }));

      toast.success('Sample setup loaded. Demo media and product details are ready.');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to load the sample setup.');
    } finally {
      setLoadingSampleSetup(false);
    }
  }

  async function goToStep(nextStep: StepId) {
    if (nextStep > currentStep) {
      for (let step = currentStep; step < nextStep; step += 1) {
        if (!validateStep(step as StepId)) return;
      }
    }

    if (nextStep === 4) {
      if (bootstrappingProject) return;
      setBootstrappingProject(true);
      try {
        void createDraftProjectIfNeeded()
          .catch((error: any) => {
            const message = error?.error?.message || 'Failed to prepare the draft project.';
            toast.error(message);
          })
          .finally(() => {
            setBootstrappingProject(false);
          });
      } catch (error: any) {
        return;
      }
    }

    setCurrentStep(nextStep);
  }

  async function handleCreateFromWizard() {
    if (submittingRender) return;
    if (!validateStep(1)) {
      setCurrentStep(1);
      return;
    }
    if (!validateStep(2)) {
      setCurrentStep(2);
      return;
    }
    if (!validateStep(3)) {
      setCurrentStep(3);
      return;
    }
    if (!validateStep(4)) {
      setCurrentStep(4);
      return;
    }

    setSubmittingRender(true);

    try {
      const projectId = await createDraftProjectIfNeeded();
      const baseSelectedAssetIds = selectedAssetIds.slice();
      const baseScripts = scriptDrafts.map((script) => ({ ...script }));
      const pendingProjectPreview = {
        id: projectId,
        title: productBriefDraft.productName.trim() || 'Untitled product',
        status: 'pending',
        createdAt: new Date().toISOString(),
      };

      if (typeof window !== 'undefined') {
        try {
          window.sessionStorage.setItem(PENDING_PROJECT_STORAGE_KEY, JSON.stringify(pendingProjectPreview));
        } catch {}
        window.dispatchEvent(
          new CustomEvent('project:created', {
            detail: pendingProjectPreview,
          }),
        );
      }

      toast.success('Task created. You can track progress in Projects.');
      router.push('/workspace/projects');

      void (async () => {
        try {
          const uploadedAssetIds = await uploadPendingLocalFiles(projectId);
          const resolvedSelectedAssetIds = Array.from(new Set([...baseSelectedAssetIds, ...uploadedAssetIds]));

          await Api.updateProject(projectId, {
            selectedAssetIds: resolvedSelectedAssetIds,
            promoEnabled: productBriefDraft.promotionalPricingEnabled,
            promoInfo: productBriefDraft.promotionalPricingEnabled
              ? {
                  originalPrice: productBriefDraft.originalPrice.trim(),
                  salePrice: productBriefDraft.salePrice.trim(),
                  discountLabel: productBriefDraft.promoDescription.trim(),
                }
              : undefined,
            renderOptions: {
              captionsEnabled: true,
              backgroundMusicEnabled: settingsDraft.music !== 'none',
              stylePreset: 'balanced',
              useHookClip: true,
              animateImages: true,
              shuffleVideoSlices: true,
            },
          });

          for (const script of baseScripts) {
            await Api.updateProjectScript(projectId, script.id, {
              styleLabel: script.style,
              hookText: script.hook,
              bodyText: script.body,
              ctaText: script.cta,
              isSelected: selectedScriptIds.includes(script.id),
            });
          }

          await Api.createVideoJobs(projectId, { overwrite: true });
          if (typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent('project:created', {
                detail: {
                  id: projectId,
                  title: productBriefDraft.productName.trim() || 'Untitled product',
                  status: 'pending',
                },
              }),
            );
            window.dispatchEvent(
              new CustomEvent('project:updated', {
                detail: {
                  id: projectId,
                  title: productBriefDraft.productName.trim() || 'Untitled product',
                  status: 'pending',
                },
              }),
            );
          }
        } catch (error: any) {
          const message = error?.error?.message || 'Task was created, but rendering needs attention.';
          toast.error(message);
        }
      })();
    } catch (error: any) {
      const message = error?.error?.message || 'The project was not fully started. Please review the project in workspace.';
      toast.error(message);
    }
  }

  return (
    <div className="relative isolate -m-4 min-h-[calc(100vh-65px)] overflow-hidden bg-zinc-950 text-zinc-100 sm:-m-6">
      <div className="pointer-events-none absolute inset-0 hero-grid opacity-35" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-[radial-gradient(circle_at_top,rgba(96,165,250,0.24),transparent_60%)]" />

      <div className="relative mx-auto min-h-[calc(100vh-65px)] max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Build short video ads from product inputs
          </h1>
        </div>

        <div className="space-y-6">
          <WizardProgress currentStep={currentStep} onSelect={goToStep} />

          {currentStep === 1 ? (
            <MediaStep
              selectedIds={selectedAssetIds}
              localUploads={localUploadDrafts}
              selectedCount={selectedAssetIds.length}
              isLoadingSample={loadingSampleSetup}
              onLoadSample={() => void loadSampleSetup()}
              onChangeSelectedIds={setSelectedAssetIds}
              onChangeLocalUploads={setLocalUploadDrafts}
              onRemoveLocalUpload={removeLocalUpload}
              onNext={() => goToStep(2)}
            />
          ) : null}

          {currentStep === 2 ? (
          <ProductBriefStep
              draft={productBriefDraft}
              onChange={setProductBriefDraft}
              onBack={() => setCurrentStep(1)}
              onNext={() => {
                const errorMessage = validateProductBriefDraft(productBriefDraft);
                if (errorMessage) {
                  toast.error(errorMessage);
                  return;
                }
                setCurrentStep(3);
              }}
            />
          ) : null}

          {currentStep === 3 ? (
            <SettingsStep
              draft={settingsDraft}
              onChange={setSettingsDraft}
              onBack={() => setCurrentStep(2)}
              onNext={() => goToStep(4)}
            />
          ) : null}

          {currentStep === 4 ? (
            <ScriptsStep
              projectId={draftProjectId}
              scripts={scriptDrafts}
              selectedIds={selectedScriptIds}
              onChangeScripts={setScriptDrafts}
              onChangeSelectedIds={setSelectedScriptIds}
              onBack={() => setCurrentStep(3)}
              onNext={() => goToStep(5)}
              isBootstrapping={bootstrappingProject}
              scriptsLoadedForProjectId={scriptsLoadedForProjectId}
              onScriptsReady={setScriptsLoadedForProjectId}
            />
          ) : null}

          {currentStep === 5 ? (
            <RenderStep
              productBrief={productBriefDraft}
              settings={settingsDraft}
              scripts={scriptDrafts}
              selectedIds={selectedScriptIds}
              selectedAssetCount={selectedAssetIds.length}
              localUploadCount={localUploadDrafts.length}
              showFreePlanWatermarkNotice={showFreePlanWatermarkNotice}
              submitting={submittingRender}
              onCreate={handleCreateFromWizard}
              onBack={() => setCurrentStep(4)}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
