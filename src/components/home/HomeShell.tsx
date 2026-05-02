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
    description: 'Start a new task directly or jump in with product media you already uploaded to My Assets.',
    href: '/create',
    icon: Clapperboard,
    accent: 'from-violet-500/20 to-indigo-500/10',
    cta: 'Start creating',
  },
  {
    step: '02',
    title: 'Fill in the video details',
    description: 'Follow the guided task flow to add product info, selling points, audience, and supporting media.',
    href: '/create',
    icon: FilePenLine,
    accent: 'from-cyan-500/20 to-sky-500/10',
    cta: 'Open task flow',
  },
  {
    step: '03',
    title: 'Review a ready video',
    description: 'When the workflow finishes, your ad-ready output is waiting in Projects for review and download.',
    href: '/workspace/projects',
    icon: PlaySquare,
    accent: 'from-emerald-500/20 to-lime-500/10',
    cta: 'View projects',
  },
] as const;

const INSPIRATION_ITEMS = [
  {
    title: 'Skincare promo cut',
    subtitle: 'A polished vertical ad with clean captions, close product framing, and a direct CTA finish.',
    badge: 'Beauty',
    meta: '9:16 • 29 sec',
  },
  {
    title: 'Kitchen gadget demo',
    subtitle: 'A fast-selling proof-focused output built for ecommerce landing traffic and paid social.',
    badge: 'Demo',
    meta: '9:16 • 31 sec',
  },
  {
    title: 'Pet product hook ad',
    subtitle: 'A short hook-first structure that gets to the benefit quickly and closes with clarity.',
    badge: 'Hook-first',
    meta: '9:16 • 27 sec',
  },
  {
    title: 'Home product launch',
    subtitle: 'A more premium launch-style output for campaign pushes and new product drops.',
    badge: 'Launch',
    meta: '9:16 • 34 sec',
  },
] as const;

export function HomeShell() {
  return (
    <div className="-m-4 min-h-[calc(100vh-65px)] bg-zinc-950 text-zinc-100 sm:-m-6">
      <div className="min-h-[calc(100vh-65px)] bg-[radial-gradient(circle_at_top,rgba(124,58,237,0.15),transparent_28%),radial-gradient(circle_at_75%_20%,rgba(59,130,246,0.10),transparent_22%)]">
        <div className="mx-auto flex max-w-7xl flex-col gap-12 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
          <section className="rounded-[32px] border border-zinc-800 bg-zinc-950/80 p-6 shadow-[0_24px_80px_rgba(2,6,23,0.45)] sm:p-8 lg:p-10">
            <div className="mx-auto max-w-4xl text-center">
              <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-200">
                <Sparkles className="h-3.5 w-3.5" />
                Product info to short video ads
              </div>
              <h1 className="mt-5 text-4xl font-semibold tracking-tight text-zinc-100 sm:text-5xl lg:text-6xl">
                Turn product inputs into ad-ready short videos.
              </h1>
              <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-zinc-400 sm:text-base">
                Start from product details and uploaded media. Sprokl guides the workflow from task creation to a ready-to-use video you can review inside Projects.
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
            <div className="mb-5 flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">Quick Start</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-100">Three steps from task to finished video</h2>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              {QUICK_START_ITEMS.map(({ step, title, description, href, icon: Icon, accent, cta }) => (
                <Link
                  key={title}
                  href={href}
                  className="group rounded-[28px] border border-zinc-800 bg-zinc-900/80 p-6 transition-all duration-150 hover:border-zinc-700 hover:bg-zinc-900"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">{step}</span>
                    <div className={`flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br ${accent}`}>
                      <Icon className="h-5 w-5 text-zinc-100" />
                    </div>
                  </div>
                  <h3 className="mt-8 text-lg font-semibold text-zinc-100">{title}</h3>
                  <p className="mt-3 text-sm leading-7 text-zinc-400">{description}</p>
                  <div className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-zinc-300 transition group-hover:text-zinc-100">
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

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {INSPIRATION_ITEMS.map(({ title, subtitle, badge, meta }, index) => (
                <Link
                  key={title}
                  href="/workspace/projects"
                  className="group overflow-hidden rounded-[28px] border border-zinc-800 bg-zinc-900/80 transition-all duration-150 hover:border-zinc-700"
                >
                  <div
                    className={[
                      'relative h-44 border-b border-zinc-800',
                      index === 0
                        ? 'bg-[radial-gradient(circle_at_24%_22%,rgba(124,58,237,0.32),transparent_35%),linear-gradient(135deg,#18181b,#09090b)]'
                        : index === 1
                          ? 'bg-[radial-gradient(circle_at_80%_20%,rgba(59,130,246,0.30),transparent_32%),linear-gradient(135deg,#18181b,#09090b)]'
                          : index === 2
                            ? 'bg-[radial-gradient(circle_at_50%_15%,rgba(16,185,129,0.24),transparent_30%),linear-gradient(135deg,#18181b,#09090b)]'
                            : 'bg-[radial-gradient(circle_at_25%_20%,rgba(245,158,11,0.28),transparent_30%),linear-gradient(135deg,#18181b,#09090b)]',
                    ].join(' ')}
                  >
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_10%,rgba(9,9,11,0.25)_55%,rgba(9,9,11,0.7)_100%)]" />
                    <div className="absolute left-4 top-4 inline-flex items-center rounded-full border border-zinc-700 bg-zinc-950/85 px-2.5 py-1 text-[11px] font-semibold text-zinc-300">
                      {badge}
                    </div>
                    <div className="absolute bottom-4 left-4 right-4">
                      <div className="text-sm font-semibold text-zinc-100">{meta}</div>
                    </div>
                  </div>
                  <div className="p-5">
                    <h3 className="text-base font-semibold text-zinc-100">{title}</h3>
                    <p className="mt-2 text-sm leading-7 text-zinc-400">{subtitle}</p>
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
