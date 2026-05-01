"use client";
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { APP_NAME } from '@/shared/constants/app';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { FolderOpen } from 'lucide-react';
import { ProjectList } from '@/components/common/ProjectList';
import { useProjects } from '@/components/providers/ProjectsProvider';
import { ScrollArea } from '@/components/ui/scroll-area';
import { HeaderAccountMenu } from '@/components/layout/HeaderAccountMenu';
import { cn } from '@/lib/utils';
import { useSession } from '@/lib/auth-client';

export function AppHeader() {
  const { items, loading } = useProjects();
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { status } = useSession();
  const isAuthRoute =
    pathname?.startsWith('/sign-in') ||
    pathname?.startsWith('/sign-up') ||
    pathname?.startsWith('/sso-callback');
  const isPublicHome = pathname === '/' && status !== 'authenticated';
  const isCreateSurface =
    pathname === '/' ||
    pathname?.startsWith('/create') ||
    pathname?.startsWith('/workspace') ||
    pathname?.startsWith('/project') ||
    pathname?.startsWith('/assets');
  const brandHref = pathname === '/' ? '/' : '/workspace';

  useEffect(() => {
    function handleProjectSelect() {
      setOpen(false);
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('project:list-clicked', handleProjectSelect as any);
      return () => window.removeEventListener('project:list-clicked', handleProjectSelect as any);
    }
  }, []);

  if (isAuthRoute) {
    return null;
  }

  return (
    <header
      className={cn(
        'w-full px-4 py-3 flex items-center justify-between',
        isCreateSurface
          ? 'border-b border-zinc-800/60 bg-zinc-950/90 text-zinc-100 backdrop-blur-md'
          : 'border-b border-gray-200 dark:border-gray-800',
      )}
    >
      <div className="flex items-center gap-2">
        {/* Mobile projects access */}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              aria-label="Open projects"
            >
              <FolderOpen className="h-5 w-5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" side="bottom" className="w-[min(420px,calc(100vw-1rem))] p-0">
            <div className="border-b border-gray-200 dark:border-gray-800 px-3 py-2 text-sm font-medium">
              Projects
            </div>
            <ScrollArea className="h-[70vh] overscroll-contain pr-2">
              {loading && items.length === 0 ? (
                <div className="px-3 py-2 text-sm text-muted-foreground">Loading…</div>
              ) : items.length === 0 ? (
                <div className="px-3 py-3 text-sm text-gray-600 dark:text-gray-300">
                  <div>No projects yet.</div>
                </div>
              ) : (
                <ProjectList items={items} fetchOnMount={false} />
              )}
            </ScrollArea>
          </PopoverContent>
        </Popover>
        <Link href={brandHref} className={cn('font-semibold tracking-tight', isCreateSurface ? 'text-zinc-100' : '')}>
          {APP_NAME}
        </Link>
      </div>
      {isPublicHome ? (
        <div className="flex items-center gap-2">
          <Link
            href="/sign-in"
            className="inline-flex items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-200 transition-all duration-150 hover:border-zinc-700 hover:bg-zinc-800 hover:text-zinc-100"
          >
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-all duration-150 hover:bg-primary/90 active:scale-[0.98]"
          >
            Start free
          </Link>
        </div>
      ) : (
        <div className="flex items-center gap-1">
          <HeaderAccountMenu />
        </div>
      )}
    </header>
  );
}
