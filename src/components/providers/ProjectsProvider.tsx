"use client";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Api } from '@/lib/api-client';
import { toast } from 'sonner';
import { normalizeProjectDisplayStatus } from '@/shared/project-status';

type ProjectItem = any;

type ProjectsContextValue = {
  items: ProjectItem[];
  loading: boolean;
  refresh: () => void;
};

const ProjectsContext = createContext<ProjectsContextValue | null>(null);
const PENDING_PROJECT_STORAGE_KEY = 'sprokl:pending-project-preview';

function readPendingProjectPreview() {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.sessionStorage.getItem(PENDING_PROJECT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      id?: string;
      title?: string;
      status?: string;
      createdAt?: string;
    };
    if (!parsed?.id) return null;

    const createdAtMs = parsed.createdAt ? Date.parse(parsed.createdAt) : Number.NaN;
    if (Number.isFinite(createdAtMs) && Date.now() - createdAtMs > 10 * 60 * 1000) {
      window.sessionStorage.removeItem(PENDING_PROJECT_STORAGE_KEY);
      return null;
    }

    return {
      id: parsed.id,
      title: parsed.title || 'Untitled project',
      status: parsed.status || 'pending',
      createdAt: parsed.createdAt || new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

function clearPendingProjectPreview(projectId?: string) {
  if (typeof window === 'undefined') return;

  try {
    const raw = window.sessionStorage.getItem(PENDING_PROJECT_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as { id?: string };
    if (!projectId || parsed?.id === projectId) {
      window.sessionStorage.removeItem(PENDING_PROJECT_STORAGE_KEY);
    }
  } catch {}
}

function mergePendingProjectPreview(items: ProjectItem[]) {
  const pendingPreview = readPendingProjectPreview();
  if (!pendingPreview) return items;
  if (items.some((item) => item.id === pendingPreview.id)) {
    clearPendingProjectPreview(pendingPreview.id);
    return items;
  }
  return [pendingPreview, ...items];
}

export function ProjectsProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ProjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const previousStatusMapRef = useRef<Record<string, string | null | undefined>>({});
  const hasInitialSnapshotRef = useRef(false);

  const refresh = useCallback(() => {
    setLoading(true);
    Api.getProjects()
      .then((r: any) => setItems(mergePendingProjectPreview(Array.isArray(r) ? r : [])))
      .catch(() => setItems(mergePendingProjectPreview([])))
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
        const previousStatus = previous[item.id];
        if (typeof previousStatus !== 'string' || previousStatus.length === 0) {
          return;
        }
        const before = normalizeProjectDisplayStatus(previousStatus);
        const after = normalizeProjectDisplayStatus(item.status);
        const wasGenerating = before === 'pending' || before === 'processing';
        const isDone = after === 'done';
        const isFailed = after === 'failed';

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
      const status = normalizeProjectDisplayStatus(item.status);
      return status === 'pending' || status === 'processing';
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
      clearPendingProjectPreview(id);
      setItems((prev) => prev.filter((it) => it.id !== id));
    }
    function onUpdated(e: any) {
      const { id, status, title } = e?.detail || {};
      if (!id) return;
      setItems((prev) => {
        if (prev.some((it) => it.id === id)) {
          return prev.map((it) => (it.id === id ? { ...it, status: status ?? it.status, title: title ?? it.title } : it));
        }
        const pendingPreview = readPendingProjectPreview();
        if (pendingPreview?.id === id) {
          return [{ ...pendingPreview, status: status ?? pendingPreview.status, title: title ?? pendingPreview.title }, ...prev];
        }
        return prev;
      });
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
