"use client";

import Link from 'next/link';
import {
  ArrowRight,
  CheckCircle2,
  Clapperboard,
  FilePenLine,
  FolderOpen,
  PlaySquare,
  Sparkles,
} from 'lucide-react';

const QUICK_START_ITEMS = [
  {
    step: '01',
    title: 'Create a task',
    description: 'Start a new task or reuse media already in My Assets.',
    href: '/create',
    icon: Clapperboard,
    accent: 'from-violet-500/20 to-indigo-500/10',
    cta: 'Start creating',
  },
  {
    step: '02',
    title: 'Fill in the video details',
    description: 'Fill in the guided product details and creative settings.',
    href: '/create',
    icon: FilePenLine,
    accent: 'from-cyan-500/20 to-sky-500/10',
    cta: 'Start creating',
  },
  {
    step: '03',
    title: 'Review a ready video',
    description: 'Check finished outputs and continue in Projects.',
    href: '/workspace/projects',
    icon: PlaySquare,
    accent: 'from-emerald-500/20 to-lime-500/10',
    cta: 'View projects',
  },
] as const;

const INSPIRATION_ITEMS = [
  {
    badge: 'Beauty',
    src: '/template/basic/preview.mp4',
    poster: '/template/basic/preview.jpg',
  },
  {
    badge: 'Demo',
    src: '/template/cyberpunk/preview.mp4',
    poster: '/template/cyberpunk/preview.jpg',
  },
  {
    badge: 'Hook-first',
    src: '/template/anime/preview.mp4',
    poster: '/template/anime/preview.jpg',
  },
  {
    badge: 'Launch',
    src: '/template/noir/preview.mp4',
    poster: '/template/noir/preview.jpg',
  },
] as const;

export function HomeShell() {
  return (
    <div className="-m-4 min-h-[calc(100vh-65px)] bg-zinc-950 text-zinc-100 sm:-m-6">
      <div className="min-h-[calc(100vh-65px)] bg-[radial-gradient(circle_at_top,rgba(124,58,237,0.15),transparent_28%),radial-gradient(circle_at_75%_20%,rgba(59,130,246,0.10),transparent_22%)]">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          <section className="rounded-[32px] border border-zinc-800 bg-zinc-950/80 p-6 shadow-[0_24px_80px_rgba(2,6,23,0.45)] sm:p-8 lg:p-10">
            <div className="mx-auto max-w-4xl text-center">
              <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-200">
                <Sparkles className="h-3.5 w-3.5" />
                Product info to short video ads
              </div>
              <h1 className="mx-auto mt-5 max-w-3xl text-3xl font-semibold tracking-tight text-zinc-100 sm:text-4xl lg:text-5xl">
                Turn product inputs into ad-ready short videos.
              </h1>
              <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-zinc-400 sm:text-[15px]">
                Start from product details and media, then move through a guided flow to a finished video.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link
                  href="/create"
                  className="inline-flex min-w-[220px] items-center justify-center gap-2 rounded-2xl bg-white px-7 py-4 text-base font-semibold text-zinc-950 shadow-[0_18px_40px_rgba(255,255,255,0.14)] transition-all duration-150 hover:-translate-y-0.5 hover:bg-zinc-200 active:translate-y-0 active:scale-[0.99]"
                >
                  Create Task
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/workspace/projects"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-zinc-700 bg-zinc-900 px-6 py-4 font-medium text-zinc-100 transition-all duration-150 hover:border-zinc-600 hover:bg-zinc-800"
                >
                  View Projects
                </Link>
              </div>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-xs text-zinc-500">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900/70 px-3 py-1.5">
                  <FolderOpen className="h-3.5 w-3.5" />
                  Start from product info or My Assets
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900/70 px-3 py-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Review finished outputs in Projects
                </span>
              </div>
            </div>
          </section>

          <section>
            <div className="mb-4 flex items-end justify-between gap-4">
              <div className="max-w-2xl">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">Quick Start</p>
                <h2 className="mt-2 text-xl font-semibold tracking-tight text-zinc-100 sm:text-2xl">
                  Three steps from task to finished video
                </h2>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              {QUICK_START_ITEMS.map(({ step, title, description, href, icon: Icon, accent, cta }) => (
                <Link
                  key={title}
                  href={href}
                  className="group rounded-[28px] border border-zinc-800 bg-zinc-900/80 p-5 transition-all duration-150 hover:border-zinc-700 hover:bg-zinc-900"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">{step}</span>
                    <div className={`flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br ${accent}`}>
                      <Icon className="h-4.5 w-4.5 text-zinc-100" />
                    </div>
                  </div>
                  <h3 className="mt-6 text-base font-semibold text-zinc-100">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-zinc-400">{description}</p>
                  <div className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-zinc-300 transition group-hover:text-zinc-100">
                    {cta}
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </Link>
              ))}
            </div>
          </section>

          <section id="inspirations">
            <div className="mb-5 flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">Inspirations</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-100">See the kind of finished outputs this workflow is aiming for</h2>
              </div>
              <Link
                href="/workspace/projects"
                className="hidden text-sm font-medium text-zinc-400 transition hover:text-zinc-100 sm:inline-flex"
              >
                Open Projects
              </Link>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {INSPIRATION_ITEMS.map(({ badge, src, poster }, index) => (
                <Link
                  key={badge}
                  href="/workspace/projects"
                  className="group overflow-hidden rounded-[22px] border border-zinc-800 bg-zinc-900/80 transition-all duration-150 hover:-translate-y-1 hover:border-zinc-700 hover:shadow-[0_18px_36px_rgba(15,23,42,0.32)]"
                >
                  <div
                    className={[
                      'relative aspect-[9/16] overflow-hidden border-b border-zinc-800',
                      index === 0
                        ? 'bg-[radial-gradient(circle_at_24%_22%,rgba(124,58,237,0.28),transparent_35%),linear-gradient(135deg,#18181b,#09090b)]'
                        : index === 1
                          ? 'bg-[radial-gradient(circle_at_80%_20%,rgba(59,130,246,0.28),transparent_32%),linear-gradient(135deg,#18181b,#09090b)]'
                          : index === 2
                            ? 'bg-[radial-gradient(circle_at_50%_15%,rgba(16,185,129,0.22),transparent_30%),linear-gradient(135deg,#18181b,#09090b)]'
                            : 'bg-[radial-gradient(circle_at_25%_20%,rgba(245,158,11,0.24),transparent_30%),linear-gradient(135deg,#18181b,#09090b)]',
                    ].join(' ')}
                  >
                    <video
                      className="absolute inset-0 h-full w-full object-cover object-center opacity-92 transition-transform duration-700 group-hover:scale-[1.05]"
                      autoPlay
                      muted
                      loop
                      playsInline
                      preload="metadata"
                      poster={poster}
                      aria-hidden="true"
                    >
                      <source src={src} type="video/mp4" />
                    </video>
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(9,9,11,0.08)_0%,rgba(9,9,11,0.05)_55%,rgba(9,9,11,0.55)_100%)]" />
                    <div className="absolute left-2.5 top-2.5 inline-flex items-center rounded-full border border-zinc-700 bg-zinc-950/85 px-2.5 py-1 text-[11px] font-semibold text-zinc-300">
                      {badge}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
