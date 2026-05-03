"use client";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Api } from '@/lib/api-client';
import { toast } from 'sonner';

type ProjectItem = any;

type ProjectsContextValue = {
  items: ProjectItem[];
  loading: boolean;
  refresh: () => void;
};

const ProjectsContext = createContext<ProjectsContextValue | null>(null);

export function ProjectsProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ProjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const previousStatusMapRef = useRef<Record<string, string | null | undefined>>({});
  const hasInitialSnapshotRef = useRef(false);

  const refresh = useCallback(() => {
    setLoading(true);
    Api.getProjects()
      .then((r: any) => setItems(Array.isArray(r) ? r : []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    // Prefetch immediately on first client render to avoid popover delay
    refresh();
  }, [refresh]);

  useEffect(() => {
    const previous = previousStatusMapRef.current;
    const next = Object.fromEntries(items.map((item) => [item.id, item.status])) as Record<string, string | null | undefined>;

    if (hasInitialSnapshotRef.current) {
      items.forEach((item) => {
        const before = (previous[item.id] ?? '').toLowerCase();
        const after = (item.status ?? '').toLowerCase();
        const wasGenerating =
          before === 'generating' ||
          before === 'scripts_generated' ||
          before === 'pending' ||
          before === 'processing' ||
          before === 'queued';
        const isDone = after === 'done' || after === 'completed' || after === 'ready';
        const isFailed = after === 'failed' || after === 'error' || after === 'cancelled';

        if (wasGenerating && isDone) {
          toast.success(`${item.title || item.name || 'Your video'} is ready.`);
        } else if (before && before !== after && isFailed) {
          toast.error(`${item.title || item.name || 'Your video'} failed to render.`);
        }
      });
    } else {
      hasInitialSnapshotRef.current = true;
    }

    previousStatusMapRef.current = next;
  }, [items]);

  useEffect(() => {
    const hasActiveProjects = items.some((item) => {
      const status = (item.status ?? '').toLowerCase();
      return (
        status === 'generating' ||
        status === 'scripts_generated' ||
        status === 'pending' ||
        status === 'processing' ||
        status === 'queued'
      );
    });

    if (!hasActiveProjects) return;

    const interval = window.setInterval(() => {
      refresh();
    }, 15000);

    return () => window.clearInterval(interval);
  }, [items, refresh]);

  useEffect(() => {
    // Keep in sync with app-level events
    function onDeleted(e: any) {
      const id = e?.detail?.projectId;
      if (!id) return;
      setItems((prev) => prev.filter((it) => it.id !== id));
    }
    function onUpdated(e: any) {
      const { id, status, title } = e?.detail || {};
      if (!id) return;
      setItems((prev) => prev.map((it) => (it.id === id ? { ...it, status: status ?? it.status, title: title ?? it.title } : it)));
    }
    function onCreated(e: any) {
      const item = e?.detail;
      if (!item || !item.id) return;
      setItems((prev) => (prev.some((p) => p.id === item.id) ? prev : [item, ...prev]));
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('project:deleted', onDeleted as any);
      window.addEventListener('project:updated', onUpdated as any);
      window.addEventListener('project:created', onCreated as any);
      return () => {
        window.removeEventListener('project:deleted', onDeleted as any);
        window.removeEventListener('project:updated', onUpdated as any);
        window.removeEventListener('project:created', onCreated as any);
      };
    }
  }, []);

  const value = useMemo<ProjectsContextValue>(() => ({ items, loading, refresh }), [items, loading, refresh]);

  return <ProjectsContext.Provider value={value}>{children}</ProjectsContext.Provider>;
}

export function useProjects() {
  const ctx = useContext(ProjectsContext);
  if (!ctx) return { items: [] as ProjectItem[], loading: true, refresh: () => {} } satisfies ProjectsContextValue;
  return ctx;
}
