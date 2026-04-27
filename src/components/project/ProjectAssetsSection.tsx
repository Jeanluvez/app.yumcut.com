"use client";

import { useEffect, useRef, useState } from 'react';
import { Loader2, UploadCloud } from 'lucide-react';
import { toast } from 'sonner';
import { Api } from '@/lib/api-client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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

function formatBytes(value: string) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function ProjectAssetsSection({
  projectId,
  onChanged,
}: {
  projectId: string;
  onChanged?: () => void;
}) {
  const [items, setItems] = useState<AssetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [assetType, setAssetType] = useState<'image' | 'video' | 'hook'>('image');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      const result = await Api.getAssets(projectId);
      setItems(Array.isArray(result) ? (result as AssetItem[]) : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, [projectId]);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    event.target.value = '';
    if (!file) return;

    setUploading(true);
    try {
      await Api.uploadAsset(projectId, file, assetType);
      toast.success('Asset uploaded');
      await refresh();
      onChanged?.();
    } catch (err: any) {
      toast.error(err?.error?.message || 'Failed to upload asset');
    } finally {
      setUploading(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex-col items-start gap-1">
        <CardTitle>Assets</CardTitle>
        <CardDescription>Upload source material for this project. This step stores files in Supabase Storage and records them in the asset library.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept={assetType === 'image' ? 'image/png,image/jpeg,image/webp' : 'video/mp4,video/quicktime,video/webm'}
          onChange={handleFileChange}
        />

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="grid gap-2 sm:w-52">
            <Label>Asset Type</Label>
            <Select value={assetType} onValueChange={(value: 'image' | 'video' | 'hook') => setAssetType(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="image">Image</SelectItem>
                <SelectItem value="video">Video</SelectItem>
                <SelectItem value="hook">Hook Video</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
            Upload Asset
          </Button>
        </div>

        {loading ? (
          <div className="text-sm text-gray-500 dark:text-gray-400">Loading assets...</div>
        ) : items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-200 px-4 py-6 text-sm text-gray-500 dark:border-gray-800 dark:text-gray-400">
            No assets uploaded for this project yet.
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.id} className="rounded-lg border border-gray-200 px-4 py-3 dark:border-gray-800">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{item.filename}</div>
                    <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {formatBytes(item.sizeBytes)} • {new Date(item.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <Badge variant={item.type === 'hook' ? 'info' : 'default'}>{item.type}</Badge>
                </div>
                <a
                  href={item.storageUrl}
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
  );
}
