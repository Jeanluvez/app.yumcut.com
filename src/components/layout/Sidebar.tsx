"use client";
import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { Api } from '@/lib/api-client';
import { StatusIcon } from '@/components/common/StatusIcon';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { ChevronRight, PanelLeftOpen, PanelLeftClose, FolderOpen, Home, Image as ImageIcon, User, Video } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useSettings } from '@/hooks/useSettings';
import { AccountMenuContent } from '@/components/layout/AccountMenuContent';
import { useAppLanguage } from '@/components/providers/AppLanguageProvider';
import { useSession } from '@/lib/auth-client';
// Local UI prefs have been removed; rely on server-backed user settings

const CREATE_SURFACE_NAV_ITEMS = [
  {
    id: 'home',
    label: 'Home',
    href: '/',
    icon: Home,
    description: 'Create new project',
    match: (pathname: string | null) => pathname === '/',
  },
  {
    id: 'projects',
    label: 'Projects',
    href: '/workspace#projects-section',
    icon: Video,
    description: 'Project queue',
    match: (pathname: string | null) => pathname?.startsWith('/workspace') ?? false,
  },
  {
    id: 'assets',
    label: 'My Assets',
    href: '/workspace#assets-section',
    icon: ImageIcon,
    description: 'Uploaded media',
    match: (pathname: string | null) => pathname?.startsWith('/workspace') ?? false,
  },
] as const;

export function Sidebar({ initialOpen = true }: { initialOpen?: boolean }) {
  const { language } = useAppLanguage();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [hash, setHash] = useState('');
  const { data: session } = useSession();
  const isAdmin = !!(session?.user as any)?.isAdmin;
  const pathname = usePathname();
  const { settings, update } = useSettings();
  const isCreateSurface = pathname === '/' || pathname?.startsWith('/create/confirm/');

  useEffect(() => {
    setLoading(true);
    Api.getProjects()
      .then((r: any) => setItems(r))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const syncHash = () => setHash(window.location.hash || '');
    syncHash();
    window.addEventListener('hashchange', syncHash);
    return () => window.removeEventListener('hashchange', syncHash);
  }, []);

  // Listen for project deletions to remove from the list immediately
  useEffect(() => {
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
      setItems((prev) => {
        if (prev.some((p) => p.id === item.id)) return prev;
        return [item, ...prev];
      });
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

  // Server value is the source of truth; no localStorage sync
  const displayName = useMemo(() => {
    const n = (session?.user?.name || '').trim();
    if (n) {
      const parts = n.split(/\s+/);
      return parts.length >= 2 ? `${parts[0]} ${parts[1]}` : parts[0];
    }
    const email = session?.user?.email || '';
    return email ? email.split('@')[0] : (language === 'ru' ? 'Аккаунт' : 'Account');
  }, [language, session?.user?.name, session?.user?.email]);

  // Open state derives from server settings with SSR-provided initial fallback
  const isOpen = (settings && typeof (settings as any).sidebarOpen === 'boolean')
    ? (settings as any).sidebarOpen
    : initialOpen;
  const [mounted, setMounted] = useState(false);
  // Enable transitions only after first paint to avoid initial "dancing"
  const [enableTransitions, setEnableTransitions] = useState(false);
  useEffect(() => {
    setMounted(true);
    const raf = requestAnimationFrame(() => setEnableTransitions(true));
    return () => cancelAnimationFrame(raf);
  }, []);
  const open = mounted ? isOpen : initialOpen;

  const projectsLabel = language === 'ru' ? 'Проекты' : 'Projects';
  const collapseLabel = language === 'ru' ? 'Свернуть боковую панель' : 'Collapse sidebar';
  const expandLabel = language === 'ru' ? 'Развернуть боковую панель' : 'Expand sidebar';
  const noProjectsLabel = language === 'ru' ? 'Пока нет проектов' : 'No projects for now';

  if (isCreateSurface) {
    return (
      <aside
        className={cn(
          'shrink-0 h-full overflow-hidden border-r border-zinc-800/60 bg-zinc-950 text-zinc-100',
          enableTransitions && 'transition-[width] duration-200 ease-in-out',
          open ? 'w-[220px]' : 'w-[60px]',
        )}
      >
        <div className="flex h-full flex-col">
          <div className={cn('flex h-14 items-center border-b border-zinc-800/60', open ? 'px-4 gap-2.5' : 'justify-center px-0')}>
            <Link href="/" className="flex min-w-0 items-center gap-2.5 group">
              <Image
                src="/logo-design.png"
                alt="Sprokl logo"
                width={28}
                height={28}
                className="h-7 w-7 object-contain"
                priority
              />
              {open ? (
                <span className="truncate text-[15px] font-bold tracking-tight text-zinc-100 transition-colors duration-150 group-hover:text-blue-300">
                  Sprokl
                </span>
              ) : null}
            </Link>
          </div>

          <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-4">
            {CREATE_SURFACE_NAV_ITEMS.map(({ id, label, href, icon: Icon, description, match }) => {
              const active = id === 'projects'
                ? pathname?.startsWith('/workspace') && hash !== '#assets-section'
                : id === 'assets'
                  ? pathname?.startsWith('/workspace') && hash === '#assets-section'
                  : match(pathname);
              return (
                <Link
                  key={id}
                  href={href}
                  title={open ? undefined : label}
                  className={cn(
                    'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-150',
                    active ? 'bg-blue-500/15 text-blue-300' : 'text-zinc-500 hover:bg-zinc-800/60 hover:text-zinc-200',
                    !open && 'justify-center',
                  )}
                >
                  <Icon
                    size={17}
                    className={cn(
                      'shrink-0 transition-colors duration-150',
                      active ? 'text-blue-300' : 'text-zinc-500 group-hover:text-zinc-300',
                    )}
                  />
                  {open ? (
                    <div className="min-w-0">
                      <p className={cn('text-sm font-semibold leading-tight', active ? 'text-blue-300' : 'text-zinc-300 group-hover:text-zinc-100')}>
                        {label}
                      </p>
                      <p className="truncate text-[10px] text-zinc-600 transition-colors duration-150 group-hover:text-zinc-500">
                        {description}
                      </p>
                    </div>
                  ) : null}
                  {active ? <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-blue-400" /> : null}
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-zinc-800/60 p-2">
            <button
              onClick={() => update('sidebarOpen' as any, !open)}
              className={cn(
                'flex w-full items-center gap-2 rounded-xl px-3 py-2 text-zinc-600 transition-all duration-150 hover:bg-zinc-800/60 hover:text-zinc-300',
                !open && 'justify-center',
              )}
              title={open ? collapseLabel : expandLabel}
            >
              {open ? <PanelLeftClose size={15} /> : <PanelLeftOpen size={15} />}
              {open ? <span className="text-xs font-medium">Collapse</span> : null}
            </button>
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside
      className={cn(
        'shrink-0 h-full overflow-hidden',
        isCreateSurface
          ? 'border-r border-zinc-800/60 bg-zinc-950 text-zinc-100'
          : 'border-r border-gray-200 dark:border-gray-800',
        enableTransitions && 'transition-[width] duration-200 ease-in-out',
        open ? 'w-[280px]' : 'w-[60px]',
      )}
    >
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between px-2 py-2">
          <div className={cn('text-xs', isCreateSurface ? 'text-zinc-500' : 'text-gray-500', !open && 'sr-only')}>{projectsLabel}</div>
          <Button
            aria-label={open ? collapseLabel : expandLabel}
            title={open ? collapseLabel : expandLabel}
            variant="ghost"
            size="icon"
            className={cn(!open && 'mx-auto', isCreateSurface && 'text-zinc-300 hover:bg-zinc-900 hover:text-zinc-100')}
            onClick={() => {
              const next = !open;
              // Optimistic update through settings hook; no local storage
              update('sidebarOpen' as any, next);
            }}
          >
            {open ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
          </Button>
        </div>
        <Separator className={cn(isCreateSurface && 'bg-zinc-800/80')} />
        <ScrollArea className="flex-1">
          {open ? (
            loading ? (
              <ul>
                {Array.from({ length: 7 }).map((_, i) => (
                  <li key={i} className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 rounded-full skeleton" />
                      <div className="h-4 w-40 rounded skeleton" />
                    </div>
                  </li>
                ))}
              </ul>
            ) : items.length === 0 ? (
              <div className="h-full grid place-items-center p-4">
                <div className="text-center">
                  <FolderOpen className={cn('h-8 w-8 mx-auto mb-2', isCreateSurface ? 'text-zinc-600' : 'text-gray-400')} />
                  <p className={cn('text-sm', isCreateSurface ? 'text-zinc-500' : 'text-gray-500')}>{noProjectsLabel}</p>
                </div>
              </div>
            ) : (
              <ul>
                {items.map((p) => (
                  <li key={p.id}>
                    {(() => {
                      const isActive = pathname?.startsWith(`/project/${p.id}`);
                      return (
                        <Button
                          asChild
                          variant="ghost"
                          className={cn(
                            'w-full justify-start gap-2 px-3 py-2 h-auto rounded-none',
                            isCreateSurface && 'text-zinc-300 hover:bg-zinc-900 hover:text-zinc-100',
                            isActive && (
                              isCreateSurface
                                ? 'bg-zinc-900 text-zinc-100 font-medium'
                                : 'bg-gray-100 text-gray-900 dark:bg-gray-900 dark:text-gray-100 font-medium'
                            ),
                          )}
                        >
                          <Link
                            href={`/project/${p.id}`}
                            className="min-w-0 flex items-center gap-2"
                            aria-current={isActive ? 'page' : undefined}
                          >
                            {/* Status icon removed when sidebar collapsed; shown only when open */}
                            <div className="shrink-0">
                              <StatusIcon status={p.status} />
                            </div>
                            <span className="truncate flex-1 text-left">{p.title}</span>
                          </Link>
                        </Button>
                      );
                    })()}
                  </li>
                ))}
              </ul>
            )
          ) : null}
        </ScrollArea>

        <Separator className={cn(isCreateSurface && 'bg-zinc-800/80')} />
        <div className="p-3">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                className={cn(
                  'w-full justify-between',
                  !open && 'px-0',
                  isCreateSurface && 'text-zinc-300 hover:bg-zinc-900 hover:text-zinc-100',
                  isAdmin && 'border border-red-500/70 text-red-600 dark:border-red-500/50 dark:text-red-400',
                )}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1 text-left">
                  <User className="h-4 w-4" />
                  <span className={cn("truncate font-medium text-sm", !open && "hidden")}>{displayName}</span>
                </div>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent side="right" align="end" className="w-72 p-0">
              <AccountMenuContent />
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </aside>
  );
}
