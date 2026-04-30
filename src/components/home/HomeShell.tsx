"use client";

import Link from 'next/link';
import { ArrowRight, Boxes, Clapperboard, FolderOpen, Sparkles } from 'lucide-react';

const QUICK_START_ITEMS = [
  {
    title: 'Create from Product Info',
    description: 'Start from product name, description, selling points, and audience.',
    href: '/create',
    icon: Clapperboard,
    accent: 'from-violet-500/20 to-indigo-500/10',
  },
  {
    title: 'Create from Asset Library',
    description: 'Reuse uploaded product images and videos from your workspace library.',
    href: '/workspace#assets-section',
    icon: FolderOpen,
    accent: 'from-emerald-500/20 to-cyan-500/10',
  },
  {
    title: 'Continue with Templates',
    description: 'Use a proven ad format and then customize it inside the create flow.',
    href: '#featured-templates',
    icon: Boxes,
    accent: 'from-amber-500/20 to-orange-500/10',
  },
] as const;

const TEMPLATE_ITEMS = [
  {
    title: 'Problem / Solution',
    subtitle: 'Lead with the pain point, then reveal the product fix.',
    badge: 'Performance',
  },
  {
    title: 'UGC Product Demo',
    subtitle: 'Human-feeling short ad flow with product proof and CTA.',
    badge: 'UGC',
  },
  {
    title: 'Before / After Hook',
    subtitle: 'Fast visual contrast designed for short-form paid traffic.',
    badge: 'Best Seller',
  },
  {
    title: 'Offer Push',
    subtitle: 'Promo-first format for discount, bundle, or limited-time launch.',
    badge: 'Promo',
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
                Start a task from product details, asset library media, and proven ad formats. Sprokl handles script generation, voiceover, subtitles, and video assembly downstream.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link
                  href="/create"
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 font-medium text-primary-foreground transition-all duration-150 hover:bg-primary/90 active:scale-[0.98]"
                >
                  Create Task
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/workspace#projects-section"
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-6 py-3 font-medium text-zinc-100 transition-all duration-150 hover:border-zinc-600 hover:bg-zinc-800"
                >
                  View Projects
                </Link>
              </div>
            </div>
          </section>

          <section>
            <div className="mb-5 flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">Quick Start</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-100">Choose how you want to begin</h2>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              {QUICK_START_ITEMS.map(({ title, description, href, icon: Icon, accent }) => (
                <Link
                  key={title}
                  href={href}
                  className="group rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5 transition-all duration-150 hover:border-zinc-700 hover:bg-zinc-900"
                >
                  <div className={`mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br ${accent}`}>
                    <Icon className="h-5 w-5 text-zinc-100" />
                  </div>
                  <h3 className="text-lg font-semibold text-zinc-100">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-zinc-400">{description}</p>
                  <div className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-zinc-300 transition group-hover:text-zinc-100">
                    Open
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </Link>
              ))}
            </div>
          </section>

          <section id="featured-templates">
            <div className="mb-5 flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">Featured Templates</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-100">Start from a proven ad structure</h2>
              </div>
              <Link
                href="/create"
                className="hidden text-sm font-medium text-zinc-400 transition hover:text-zinc-100 sm:inline-flex"
              >
                Open create flow
              </Link>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {TEMPLATE_ITEMS.map(({ title, subtitle, badge }, index) => (
                <Link
                  key={title}
                  href="/create"
                  className="group overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/80 transition-all duration-150 hover:border-zinc-700"
                >
                  <div
                    className={[
                      'h-40 border-b border-zinc-800',
                      index === 0
                        ? 'bg-[radial-gradient(circle_at_20%_20%,rgba(124,58,237,0.32),transparent_35%),linear-gradient(135deg,#18181b,#09090b)]'
                        : index === 1
                          ? 'bg-[radial-gradient(circle_at_80%_20%,rgba(59,130,246,0.30),transparent_32%),linear-gradient(135deg,#18181b,#09090b)]'
                          : index === 2
                            ? 'bg-[radial-gradient(circle_at_50%_15%,rgba(244,114,182,0.28),transparent_30%),linear-gradient(135deg,#18181b,#09090b)]'
                            : 'bg-[radial-gradient(circle_at_25%_20%,rgba(245,158,11,0.28),transparent_30%),linear-gradient(135deg,#18181b,#09090b)]',
                    ].join(' ')}
                  />
                  <div className="p-5">
                    <span className="inline-flex rounded-full border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-[11px] font-semibold text-zinc-300">
                      {badge}
                    </span>
                    <h3 className="mt-3 text-base font-semibold text-zinc-100">{title}</h3>
                    <p className="mt-2 text-sm leading-6 text-zinc-400">{subtitle}</p>
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
