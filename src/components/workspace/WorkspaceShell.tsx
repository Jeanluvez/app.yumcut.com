"use client";

import { useMemo, useState } from 'react';
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

export function WorkspaceShell() {
  const { items, loading, refresh } = useProjects();
  const [form, setForm] = useState<FormState>(initialForm);
  const [submitting, setSubmitting] = useState(false);

  const projectCountLabel = useMemo(() => `${items.length} project${items.length === 1 ? '' : 's'}`, [items.length]);

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

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
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
                  <div key={item.id} className="rounded-lg border border-gray-200 px-4 py-3 dark:border-gray-800">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{item.title || item.name || 'Untitled project'}</div>
                    <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      <span>{formatStatus(item.status)}</span>
                      <span className="mx-2">•</span>
                      <span>{item.createdAt ? new Date(item.createdAt).toLocaleString() : 'Unknown time'}</span>
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
