"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Circle, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useAuthActions, useSession } from "@/lib/auth-client";
import { SproklLogo } from "@/components/brand/SproklLogo";

type AuthEntryShellProps = {
  mode: "sign-in" | "sign-up";
};

const COPY = {
  "sign-in": {
    eyebrow: "TIKTOK VIDEOS FOR SELLERS",
    title: "Welcome back",
    description:
      "Sign in to your Sprokl account and continue building product-to-video workflows without leaving the workspace.",
    primaryCta: "Continue with Google",
    secondaryCta: "Continue with Apple",
    footerLabel: "Don't have an account?",
    footerLink: "Create one free",
    footerHref: "/sign-up",
    loading: "Redirecting...",
    subtitle: "Sign in to your Sprokl account",
  },
  "sign-up": {
    eyebrow: "TIKTOK VIDEOS FOR SELLERS",
    title: "Start for free",
    description:
      "Create your Sprokl workspace. No credit card required now. Upgrade and pricing selection can come later inside the product.",
    primaryCta: "Sign up with Google",
    secondaryCta: "Sign up with Apple",
    footerLabel: "Already have an account?",
    footerLink: "Sign in",
    footerHref: "/sign-in",
    loading: "Redirecting...",
    subtitle: "Use a real social login to create your account",
  },
} as const;

const VALUE_POINTS = [
  {
    title: "3 AI scripts in seconds",
    description: "Claude generates Hook, Body & CTA for every style",
  },
  {
    title: "Auto-synthesize videos",
    description: "TTS + your assets + music + captions — fully automated",
  },
  {
    title: "Under 10 minutes",
    description: "From product info to polished video, start to finish",
  },
] as const;

const PLAN_ITEMS = [
  { label: "Free", detail: "3 videos/mo • 7-day storage", active: false },
  { label: "Pro", detail: "30 videos/mo • 30-day storage", active: true, badge: "Popular" },
  { label: "Business", detail: "Unlimited • 90-day storage", active: false },
] as const;

export function AuthEntryShell({ mode }: AuthEntryShellProps) {
  const copy = COPY[mode];
  const { signIn, ready } = useAuthActions();
  const { status } = useSession();
  const [provider, setProvider] = useState<"google" | "apple" | null>(null);

  async function handleAuth(nextProvider: "google" | "apple") {
    if (provider || !ready) return;
    setProvider(nextProvider);
    const resetTimer = window.setTimeout(() => {
      setProvider((current) => (current === nextProvider ? null : current));
    }, 5000);
    try {
      await signIn(nextProvider, { mode });
    } catch (error) {
      window.clearTimeout(resetTimer);
      setProvider(null);
      const message = error instanceof Error ? error.message : "Unable to start authentication.";
      console.error("Failed to start Clerk OAuth redirect.", error);
      toast.error(message);
    }
  }

  const isLoading = provider !== null;
  const isSignUp = mode === "sign-up";

  return (
    <div className="-m-4 min-h-screen bg-[#08080b] text-zinc-100 sm:-m-6">
      <div className="grid min-h-screen lg:grid-cols-[520px_minmax(0,1fr)]">
        <aside className="relative overflow-hidden border-r border-white/6 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.28),transparent_26%),linear-gradient(180deg,#1a1a23_0%,#15151d_52%,#171127_100%)] px-6 py-8 sm:px-8 lg:px-10">
          <div className="flex h-full flex-col">
            <Link href="/" className="inline-flex w-fit items-center gap-3">
              <SproklLogo
                showWordmark
                className=""
                markClassName="h-8 w-8"
                labelClassName="text-[17px] font-semibold tracking-tight text-zinc-100"
              />
            </Link>

            <div className="mt-14 max-w-[360px]">
              <p className="text-xs font-medium uppercase tracking-[0.24em] text-indigo-300/85">{copy.eyebrow}</p>
              <h1 className="mt-4 text-[28px] font-semibold tracking-tight text-zinc-100 sm:text-[32px]">
                No video experience <span className="text-indigo-300">needed.</span>
              </h1>
              <p className="mt-4 text-sm leading-6 text-zinc-400">
                Turn your product info into scroll-stopping TikTok videos automatically. AI writes the script, we build the video.
              </p>
            </div>

            <div className="mt-10 max-w-[360px] space-y-4">
              {VALUE_POINTS.map((item, index) => (
                <div key={item.title} className="flex items-start gap-3.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl border border-indigo-500/25 bg-indigo-500/10">
                    {index === 0 ? (
                      <Sparkles className="h-3.5 w-3.5 text-indigo-300" />
                    ) : index === 1 ? (
                      <ShieldCheck className="h-3.5 w-3.5 text-indigo-300" />
                    ) : (
                      <Circle className="h-3.5 w-3.5 text-indigo-300" />
                    )}
                  </div>
                  <div>
                    <p className="text-[15px] font-medium leading-5 text-zinc-100 sm:text-base">{item.title}</p>
                    <p className="mt-1 text-[13px] leading-5 text-zinc-500">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-auto max-w-[360px] rounded-3xl border border-white/8 bg-white/[0.04] p-4 backdrop-blur-sm">
              <p className="text-sm italic leading-6 text-zinc-200">
                “I made 3 TikTok videos for my skincare line in one afternoon. I'd never edited a video before.”
              </p>
              <div className="mt-5 flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-400 text-xs font-semibold text-white">
                  J
                </div>
                <div>
                  <p className="text-[13px] font-medium text-zinc-100">Jasmine Okafor</p>
                  <p className="text-[11px] text-zinc-500">TikTok Shop Seller · 42K followers</p>
                </div>
              </div>
            </div>
          </div>
        </aside>

        <section className="flex items-center justify-center px-4 py-10 sm:px-6 lg:px-10">
          <div className="w-full max-w-[460px]">
            <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-1">
              <div className="grid grid-cols-2 gap-1">
                <Link
                  href="/sign-in"
                  className={[
                    "inline-flex items-center justify-center rounded-xl px-4 py-3 text-sm font-medium transition-all duration-150",
                    !isSignUp ? "bg-zinc-700/80 text-zinc-100" : "text-zinc-500 hover:text-zinc-300",
                  ].join(" ")}
                >
                  Sign In
                </Link>
                <Link
                  href="/sign-up"
                  className={[
                    "inline-flex items-center justify-center rounded-xl px-4 py-3 text-sm font-medium transition-all duration-150",
                    isSignUp ? "bg-zinc-700/80 text-zinc-100" : "text-zinc-500 hover:text-zinc-300",
                  ].join(" ")}
                >
                  Create Account
                </Link>
              </div>
            </div>

            <div className="mt-10">
              <h2 className="text-[26px] font-semibold tracking-tight text-zinc-100 sm:text-[30px]">{copy.title}</h2>
              <p className="mt-2 text-[15px] text-zinc-500">{copy.subtitle}</p>
              <p className="mt-2 text-sm leading-6 text-zinc-600">{copy.description}</p>
            </div>

            {isSignUp ? (
              <div className="mt-8 grid grid-cols-3 gap-2">
                {PLAN_ITEMS.map((plan) => (
                  <div
                    key={plan.label}
                    className={[
                      "rounded-2xl border px-3 py-4 text-center",
                      plan.active
                        ? "border-violet-500/70 bg-violet-500/8"
                        : "border-white/10 bg-white/[0.02]",
                    ].join(" ")}
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span className="text-sm font-medium text-zinc-100">{plan.label}</span>
                      {plan.badge ? (
                        <span className="rounded-full bg-violet-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                          {plan.badge}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-[11px] leading-4 text-zinc-500">{plan.detail}</p>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="mt-8 grid gap-3">
              <button
                type="button"
                onClick={() => void handleAuth("google")}
                disabled={isLoading || !ready}
                className="inline-flex h-[52px] items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.08] px-6 text-sm font-medium text-zinc-100 transition-all duration-150 hover:bg-white/[0.12] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {provider === "google" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {provider !== "google" ? (
                  <Image src="/google.svg" alt="" width={16} height={16} className="h-4 w-4" />
                ) : null}
                <span>{provider === "google" ? copy.loading : copy.primaryCta}</span>
              </button>
              <button
                type="button"
                onClick={() => void handleAuth("apple")}
                disabled={isLoading || !ready}
                className="inline-flex h-[52px] items-center justify-center gap-2 rounded-2xl border border-white/10 bg-transparent px-6 text-sm font-medium text-zinc-300 transition-all duration-150 hover:border-white/18 hover:bg-white/[0.04] hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {provider === "apple" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {provider !== "apple" ? (
                  <Image src="/apple.svg" alt="" width={16} height={16} className="h-4 w-4 invert" />
                ) : null}
                <span>{provider === "apple" ? copy.loading : copy.secondaryCta}</span>
              </button>
            </div>

            <div className="mt-7 flex items-center gap-4 text-xs uppercase tracking-[0.24em] text-zinc-600">
              <span className="h-px flex-1 bg-white/10" />
              <span>Real auth only</span>
              <span className="h-px flex-1 bg-white/10" />
            </div>

            <div className="mt-7 rounded-3xl border border-white/8 bg-white/[0.03] p-5">
              <p className="text-sm font-medium text-zinc-100">
                {isSignUp ? "Account creation note" : "Sign-in note"}
              </p>
              <p className="mt-2 text-sm leading-7 text-zinc-500">
                This page currently supports live Clerk authentication through Google and Apple only. Email/password, forgot password, and pricing-bound signup remain out of scope for this pass.
              </p>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-sm text-zinc-500">
              <span>{copy.footerLabel}</span>
              <Link href={copy.footerHref} className="font-medium text-violet-300 transition hover:text-violet-200">
                {copy.footerLink}
              </Link>
              {status === "authenticated" ? (
                <Link
                  href="/workspace"
                  className="inline-flex items-center gap-1 font-medium text-zinc-200 transition hover:text-zinc-100"
                >
                  Continue to workspace
                  <ArrowRight className="h-4 w-4" />
                </Link>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
