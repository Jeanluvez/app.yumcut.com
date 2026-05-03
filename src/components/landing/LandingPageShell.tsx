"use client";

import Link from "next/link";
import {
  ArrowRight,
  Boxes,
  CheckCircle2,
  Clapperboard,
  FileText,
  FolderOpen,
  Mic2,
  PlaySquare,
  Sparkles,
  Subtitles,
  Wand2,
} from "lucide-react";
import { SproklLogo } from "@/components/brand/SproklLogo";

const WORKFLOW_STEPS = [
  {
    step: "01",
    title: "Choose assets or upload video",
    description: "Select assets from your library or upload new video files.",
    icon: FileText,
  },
  {
    step: "02",
    title: "Add product information",
    description: "Enter the product details that shape the video output.",
    icon: FolderOpen,
  },
  {
    step: "03",
    title: "Review videos in Projects",
    description: "Open Projects to view the generated videos and manage outputs.",
    icon: PlaySquare,
  },
] as const;

const CAPABILITIES = [
  {
    title: "Script generation",
    description: "Create multiple hooks, bodies, and CTAs from one product brief.",
    icon: Wand2,
  },
  {
    title: "Voiceover",
    description: "Turn your ad script into usable narration without manual recording.",
    icon: Mic2,
  },
  {
    title: "Captions",
    description: "Generate subtitles that fit short-form video pacing and readability.",
    icon: Subtitles,
  },
  {
    title: "Video assembly",
    description: "Combine script, media, audio, and captions into finished vertical ad variants.",
    icon: Clapperboard,
  },
] as const;

const INSPIRATION_ITEMS = [
  {
    badge: "Performance",
    src: "/template/basic/preview.mp4",
    poster: "/template/basic/preview.jpg",
  },
  {
    badge: "UGC",
    src: "/template/cyberpunk/preview.mp4",
    poster: "/template/cyberpunk/preview.jpg",
  },
  {
    badge: "Best Seller",
    src: "/template/anime/preview.mp4",
    poster: "/template/anime/preview.jpg",
  },
  {
    badge: "Promo",
    src: "/template/noir/preview.mp4",
    poster: "/template/noir/preview.jpg",
  },
] as const;

const DIFFERENTIATORS = [
  "Start from product information instead of editing a blank timeline.",
  "Keep scripts, assets, voiceover, captions, and outputs in one workflow.",
  "Generate multiple short-form variants without rebuilding each ad manually.",
  "Turn hours of manual video cutting into minutes with a guided creation flow.",
] as const;

const USE_CASES = [
  {
    title: "Ecommerce sellers",
    description: "Turn product details into TikTok-style ad creatives faster.",
  },
  {
    title: "Small brands",
    description: "Ship repeatable short-form campaigns without a full video team.",
  },
  {
    title: "Affiliate marketers",
    description: "Test more angles and hooks with less production overhead.",
  },
] as const;

const FAQ_ITEMS = [
  {
    question: "Do I need video editing experience?",
    answer: "No. Sprokl is built for users who want to start from product information and assets, not from a full editing timeline.",
  },
  {
    question: "Can I upload my own product media?",
    answer: "Yes. Your uploads and product-related inputs are managed inside My Assets for reuse across future tasks.",
  },
  {
    question: "Does Sprokl handle voiceover and captions?",
    answer: "Yes. The intended workflow includes script generation, voiceover, subtitles, and final video assembly in one chain.",
  },
  {
    question: "Where do finished videos go?",
    answer: "Generated outputs live in Projects, where you can review video variants and manage finished task results.",
  },
] as const;

export function LandingPageShell() {
  return (
    <div className="-m-4 min-h-[calc(100vh-65px)] bg-[#06070a] text-zinc-100 sm:-m-6">
      <div className="min-h-[calc(100vh-65px)] bg-[radial-gradient(circle_at_top,rgba(67,56,202,0.30),transparent_24%),radial-gradient(circle_at_78%_12%,rgba(14,165,233,0.16),transparent_18%),linear-gradient(180deg,#09090b_0%,#09090b_48%,#05060a_100%)]">
        <div className="mx-auto flex max-w-7xl flex-col gap-24 px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
          <section className="grid gap-10 lg:grid-cols-[minmax(0,1.05fr)_440px] lg:items-center">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-indigo-200">
                <Sparkles className="h-3.5 w-3.5" />
                Product to video ads
              </div>
              <h1 className="mt-6 text-4xl font-semibold tracking-[-0.05em] text-zinc-100 sm:text-5xl lg:text-6xl">
                Turn product information into short video ads without starting from scratch.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-8 text-zinc-400">
                Sprokl helps sellers move from product brief to ad-ready video workflow with script generation, voiceover,
                subtitles, video assembly, and result management in one place.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/sign-up"
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-6 py-3 text-sm font-semibold text-zinc-950 transition-all duration-150 hover:bg-zinc-200 active:scale-[0.98]"
                >
                  Start free
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/sign-in"
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900/80 px-6 py-3 text-sm font-semibold text-zinc-100 transition-all duration-150 hover:border-zinc-600 hover:bg-zinc-800"
                >
                  Sign in
                </Link>
              </div>
              <div className="mt-8 flex flex-wrap gap-6 text-sm text-zinc-500">
                <span>Script generation</span>
                <span>Voiceover</span>
                <span>Subtitles</span>
                <span>Video assembly</span>
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-0 rounded-[36px] bg-[radial-gradient(circle_at_top,rgba(129,140,248,0.26),transparent_38%)] blur-3xl" />
              <div className="relative overflow-hidden rounded-[32px] border border-zinc-800 bg-zinc-950/90 shadow-[0_30px_120px_rgba(0,0,0,0.45)]">
                <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
                  <SproklLogo
                    showWordmark
                    markClassName="h-8 w-8"
                    labelClassName="text-[17px] font-semibold tracking-tight text-zinc-100"
                  />
                  <div className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-200">
                    Live workflow
                  </div>
                </div>
                <div className="grid gap-4 p-5">
                  <div className="rounded-3xl border border-zinc-800 bg-zinc-900/80 p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Task Input</div>
                    <div className="mt-4 grid gap-3">
                      {["Product name", "Selling points", "Target audience", "Offer angle"].map((label) => (
                        <div key={label} className="rounded-2xl border border-zinc-800 bg-zinc-950/80 px-4 py-3">
                          <div className="text-xs text-zinc-500">{label}</div>
                          <div className="mt-1 h-2.5 w-3/4 rounded-full bg-zinc-800" />
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-3xl border border-zinc-800 bg-zinc-900/80 p-4">
                      <div className="flex items-center gap-2 text-sm font-medium text-zinc-100">
                        <Boxes className="h-4 w-4 text-violet-300" />
                        Template cards
                      </div>
                      <div className="mt-4 space-y-3">
                        {["Problem / Solution", "UGC Product Demo", "Offer Push"].map((item) => (
                          <div key={item} className="rounded-2xl border border-zinc-800 bg-zinc-950 px-3 py-3 text-sm text-zinc-300">
                            {item}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-3xl border border-zinc-800 bg-zinc-900/80 p-4">
                      <div className="flex items-center gap-2 text-sm font-medium text-zinc-100">
                        <PlaySquare className="h-4 w-4 text-cyan-300" />
                        Output status
                      </div>
                      <div className="mt-4 space-y-3">
                        {[
                          ["Scripts generated", "emerald"],
                          ["Voiceover processing", "violet"],
                          ["Captions ready", "amber"],
                        ].map(([item, tone]) => (
                          <div key={item} className="flex items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-950 px-3 py-3 text-sm text-zinc-300">
                            <span>{item}</span>
                            <span
                              className={[
                                "h-2.5 w-2.5 rounded-full",
                                tone === "emerald" ? "bg-emerald-400" : tone === "violet" ? "bg-violet-400" : "bg-amber-400",
                              ].join(" ")}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section>
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">How It Works</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-100">A short workflow built for product-driven video creation</h2>
            </div>
            <div className="mt-8 grid gap-4 lg:grid-cols-3">
              {WORKFLOW_STEPS.map(({ step, title, description, icon: Icon }) => (
                <div key={title} className="rounded-[28px] border border-zinc-800 bg-zinc-900/70 p-6">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">{step}</span>
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-zinc-700 bg-zinc-950">
                      <Icon className="h-4.5 w-4.5 text-zinc-200" />
                    </div>
                  </div>
                  <h3 className="mt-8 text-xl font-semibold text-zinc-100">{title}</h3>
                  <p className="mt-3 text-sm leading-6 text-zinc-400">{description}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">Core Capabilities</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-100">One chain from script to finished output</h2>
            </div>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {CAPABILITIES.map(({ title, description, icon: Icon }) => (
                <div key={title} className="rounded-[28px] border border-zinc-800 bg-zinc-900/70 p-5">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-zinc-700 bg-zinc-950">
                    <Icon className="h-5 w-5 text-zinc-100" />
                  </div>
                  <h3 className="mt-5 text-lg font-semibold text-zinc-100">{title}</h3>
                  <p className="mt-3 text-sm leading-7 text-zinc-400">{description}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="max-w-2xl">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">Inspirations</p>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-100">Browse finished videos for inspiration</h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
                  Start from proven outputs and explore different video styles before creating your own task.
                </p>
              </div>
              <Link href="/workspace/projects" className="text-sm font-medium text-zinc-400 transition hover:text-zinc-100">
                Open projects
              </Link>
            </div>
            <div className="mt-8 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {INSPIRATION_ITEMS.map(({ badge, src, poster }, index) => (
                <Link
                  key={badge}
                  href="/workspace/projects"
                  className="group overflow-hidden rounded-[22px] border border-zinc-800 bg-zinc-900/80 transition-all duration-150 hover:-translate-y-1 hover:border-zinc-700 hover:shadow-[0_18px_36px_rgba(15,23,42,0.32)]"
                >
                  <div className="relative aspect-[9/16] overflow-hidden border-b border-zinc-800">
                    <div
                      className={[
                        "absolute inset-0",
                        index === 0
                          ? "bg-[radial-gradient(circle_at_24%_22%,rgba(124,58,237,0.28),transparent_35%),linear-gradient(135deg,#18181b,#09090b)]"
                          : index === 1
                            ? "bg-[radial-gradient(circle_at_80%_20%,rgba(59,130,246,0.28),transparent_32%),linear-gradient(135deg,#18181b,#09090b)]"
                            : index === 2
                              ? "bg-[radial-gradient(circle_at_50%_15%,rgba(16,185,129,0.22),transparent_30%),linear-gradient(135deg,#18181b,#09090b)]"
                              : "bg-[radial-gradient(circle_at_25%_20%,rgba(245,158,11,0.24),transparent_30%),linear-gradient(135deg,#18181b,#09090b)]",
                      ].join(" ")}
                    />
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

          <section className="grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            <div className="rounded-[32px] border border-zinc-800 bg-zinc-900/70 p-6 sm:p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">Why Sprokl</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-100">A tighter workflow than stitching tools together manually</h2>
              <div className="mt-8 space-y-4">
                {DIFFERENTIATORS.map((item) => (
                  <div key={item} className="flex items-start gap-3 rounded-2xl border border-zinc-800 bg-zinc-950/80 px-4 py-4">
                    <CheckCircle2 className="mt-0.5 h-4.5 w-4.5 shrink-0 text-emerald-300" />
                    <p className="text-sm leading-7 text-zinc-300">{item}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[32px] border border-zinc-800 bg-zinc-900/70 p-6 sm:p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">Use Cases</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-100">Built for teams that need more short-form output with less friction</h2>
              <div className="mt-8 grid gap-4">
                {USE_CASES.map(({ title, description }) => (
                  <div key={title} className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-5">
                    <h3 className="text-lg font-semibold text-zinc-100">{title}</h3>
                    <p className="mt-2 text-sm leading-7 text-zinc-400">{description}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-[32px] border border-zinc-800 bg-zinc-900/70 p-6 sm:p-8">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">FAQ</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-100">Common questions before you start</h2>
            </div>
            <div className="mt-8 grid gap-4 lg:grid-cols-2">
              {FAQ_ITEMS.map(({ question, answer }) => (
                <div key={question} className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-5">
                  <h3 className="text-base font-semibold text-zinc-100">{question}</h3>
                  <p className="mt-3 text-sm leading-7 text-zinc-400">{answer}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="overflow-hidden rounded-[36px] border border-indigo-500/20 bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.28),transparent_34%),linear-gradient(135deg,rgba(16,24,40,0.95),rgba(10,10,14,0.98))] p-8 sm:p-10 lg:p-12">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-indigo-200/80">Start your workflow</p>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Build your first product-to-video workflow inside Sprokl.
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-8 text-indigo-100/70 sm:text-base">
                Go from product info to finished short-form outputs, then manage videos in Projects and source material in My Assets.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/sign-up"
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-6 py-3 text-sm font-semibold text-zinc-950 transition-all duration-150 hover:bg-zinc-200 active:scale-[0.98]"
                >
                  Start free
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/sign-in"
                  className="inline-flex items-center justify-center rounded-lg border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition-all duration-150 hover:bg-white/10"
                >
                  Sign in
                </Link>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
