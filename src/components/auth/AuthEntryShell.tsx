"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Circle, Loader2, Mail, ShieldCheck, Sparkles } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useAuthActions, useSession } from "@/lib/auth-client";
import { SproklLogo } from "@/components/brand/SproklLogo";

type AuthEntryShellProps = {
  mode: "sign-in" | "sign-up";
};

const COPY = {
  "sign-in": {
    eyebrow: "SHORT-FORM VIDEO ADS",
    title: "Log in to Sprokl",
    primaryCta: "Continue with Google",
    secondaryCta: "Continue with Apple",
    emailCta: "Continue with Email",
    footerLabel: "Don't have an account?",
    footerLink: "Sign up",
    footerHref: "/sign-up",
    loading: "Redirecting...",
  },
  "sign-up": {
    eyebrow: "SHORT-FORM VIDEO ADS",
    title: "Sign up to Sprokl",
    primaryCta: "Sign up with Google",
    secondaryCta: "Sign up with Apple",
    emailCta: "Continue with Email",
    footerLabel: "Already have an account?",
    footerLink: "Sign in",
    footerHref: "/sign-in",
    loading: "Redirecting...",
  },
} as const;

const VALUE_POINTS = [
  {
    title: "3 AI scripts in seconds",
    description: "AI generates Hook, Body & CTA for every style",
  },
  {
    title: "Auto-synthesize videos",
    description: "TTS + your assets + music + captions — fully automated",
  },
  {
    title: "In a few minutes",
    description: "From product info to polished video, start to finish",
  },
] as const;

export function AuthEntryShell({ mode }: AuthEntryShellProps) {
  const copy = COPY[mode];
  const { signIn, ready, sendEmailCode, resendEmailCode, verifyEmailCode } = useAuthActions();
  const { status } = useSession();
  const [provider, setProvider] = useState<"google" | "apple" | null>(null);
  const [emailFlowOpen, setEmailFlowOpen] = useState(false);
  const [emailAddress, setEmailAddress] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [emailStage, setEmailStage] = useState<"enter" | "code">("enter");
  const [emailAction, setEmailAction] = useState<"send" | "verify" | null>(null);

  async function handleOAuth(nextProvider: "google" | "apple") {
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

  async function handleSendEmailCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || emailAction) return;

    const normalizedEmail = emailAddress.trim();
    if (!normalizedEmail) {
      toast.error("Enter an email address.");
      return;
    }

    if (mode === "sign-up" && !emailPassword.trim()) {
      toast.error("Enter a password to create your account.");
      return;
    }

    setEmailAction("send");
    try {
      await sendEmailCode(normalizedEmail, { mode, password: emailPassword });
      setEmailStage("code");
      toast.success("Check your inbox for the verification code.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to send verification code.";
      console.error("Failed to start Clerk email code flow.", error);
      toast.error(message);
    } finally {
      setEmailAction(null);
    }
  }

  async function handleVerifyEmailCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || emailAction) return;

    const normalizedCode = emailCode.trim();
    if (!normalizedCode) {
      toast.error("Enter the verification code.");
      return;
    }

    setEmailAction("verify");
    try {
      await verifyEmailCode(normalizedCode, { mode });
      toast.success(mode === "sign-up" ? "Email verified. Your account is ready." : "Signed in successfully.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to verify email code.";
      console.error("Failed to verify Clerk email code.", error);
      toast.error(message);
    } finally {
      setEmailAction(null);
    }
  }

  function resetEmailFlow() {
    setEmailStage("enter");
    setEmailCode("");
  }

  const isLoading = provider !== null || emailAction !== null;
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
                Turn your product info into short-form videos automatically. AI writes the script, we build the video.
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
                “I made 3 short-form videos for my skincare line in one afternoon. I'd never edited a video before.”
              </p>
              <div className="mt-5 flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-400 text-xs font-semibold text-white">
                  J
                </div>
                <div>
                  <p className="text-[13px] font-medium text-zinc-100">Jasmine Okafor</p>
                  <p className="text-[11px] text-zinc-500">DTC Seller · 42K followers</p>
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
                  Log In
                </Link>
                <Link
                  href="/sign-up"
                  className={[
                    "inline-flex items-center justify-center rounded-xl px-4 py-3 text-sm font-medium transition-all duration-150",
                    isSignUp ? "bg-zinc-700/80 text-zinc-100" : "text-zinc-500 hover:text-zinc-300",
                  ].join(" ")}
                >
                  Sign Up
                </Link>
              </div>
            </div>

            <div className="mt-10">
              <h2 className="text-[26px] font-semibold tracking-tight text-zinc-100 sm:text-[30px]">{copy.title}</h2>
            </div>

            <div className="mt-8 grid gap-3">
              <button
                type="button"
                onClick={() => void handleOAuth("google")}
                disabled={isLoading || !ready}
                className="inline-flex h-[52px] items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.08] px-6 text-sm font-medium text-zinc-100 transition-all duration-150 hover:bg-white/[0.12] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {provider === "google" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {provider !== "google" ? <Image src="/google.svg" alt="" width={16} height={16} className="h-4 w-4" /> : null}
                <span>{provider === "google" ? copy.loading : copy.primaryCta}</span>
              </button>
              <button
                type="button"
                onClick={() => void handleOAuth("apple")}
                disabled={isLoading || !ready}
                className="inline-flex h-[52px] items-center justify-center gap-2 rounded-2xl border border-white/10 bg-transparent px-6 text-sm font-medium text-zinc-300 transition-all duration-150 hover:border-white/18 hover:bg-white/[0.04] hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {provider === "apple" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {provider !== "apple" ? <Image src="/apple.svg" alt="" width={16} height={16} className="h-4 w-4 invert" /> : null}
                <span>{provider === "apple" ? copy.loading : copy.secondaryCta}</span>
              </button>
            </div>

            <div className="mt-7 flex items-center gap-4 text-xs uppercase tracking-[0.24em] text-zinc-600">
              <span className="h-px flex-1 bg-white/10" />
              <span>OR</span>
              <span className="h-px flex-1 bg-white/10" />
            </div>

            <button
              type="button"
              onClick={() => setEmailFlowOpen(true)}
              disabled={isLoading || !ready}
              className={[
                "mt-6 inline-flex h-[52px] w-full items-center justify-center gap-2 rounded-2xl border px-6 text-sm font-medium transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-70",
                emailFlowOpen
                  ? "border-indigo-400/30 bg-indigo-500/12 text-zinc-100"
                  : "border-white/10 bg-white/[0.03] text-zinc-300 hover:border-white/18 hover:bg-white/[0.06] hover:text-zinc-100",
              ].join(" ")}
            >
              <Mail className="h-4 w-4" />
              <span>{copy.emailCta}</span>
            </button>

            {emailFlowOpen ? (
              <form
                onSubmit={emailStage === "enter" ? handleSendEmailCode : handleVerifyEmailCode}
                className="mt-4 rounded-2xl border border-white/8 bg-white/[0.03] p-4"
              >
                {emailStage === "enter" ? (
                  <div className="space-y-3">
                    <label className="block text-[11px] font-medium uppercase tracking-[0.22em] text-zinc-500">
                      Email address
                    </label>
                    <input
                      type="email"
                      autoComplete="email"
                      value={emailAddress}
                      onChange={(event) => setEmailAddress(event.target.value)}
                      placeholder="name@example.com"
                      className="h-12 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-500 focus:border-indigo-400/40 focus:bg-white/[0.06]"
                    />
                    {mode === "sign-up" ? (
                      <div className="space-y-3">
                        <label className="block text-[11px] font-medium uppercase tracking-[0.22em] text-zinc-500">
                          Password
                        </label>
                        <input
                          type="password"
                          autoComplete="new-password"
                          value={emailPassword}
                          onChange={(event) => setEmailPassword(event.target.value)}
                          placeholder="Create a password"
                          className="h-12 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-500 focus:border-indigo-400/40 focus:bg-white/[0.06]"
                        />
                      </div>
                    ) : null}
                    {isSignUp ? <div id="clerk-captcha" className="min-h-[78px]" /> : null}
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={emailAction !== null || !ready}
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.08] px-4 text-sm font-medium text-zinc-100 transition hover:bg-white/[0.12] disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {emailAction === "send" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                        <span>{emailAction === "send" ? "Sending..." : "Send code"}</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-indigo-400/20 bg-indigo-500/10 px-4 py-4">
                      <p className="text-sm font-medium text-zinc-100">Enter your verification code</p>
                      <p className="mt-1 text-sm leading-6 text-zinc-400">
                        We sent a verification code to <span className="text-zinc-200">{emailAddress}</span>. Enter it here to continue.
                      </p>
                    </div>
                    <div className="space-y-3">
                      <label className="block text-[11px] font-medium uppercase tracking-[0.22em] text-zinc-500">
                        Verification code
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        value={emailCode}
                        onChange={(event) => setEmailCode(event.target.value)}
                        placeholder="123456"
                        className="h-12 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-500 focus:border-indigo-400/40 focus:bg-white/[0.06]"
                      />
                      <button
                        type="submit"
                        disabled={emailAction !== null || !ready}
                        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.08] px-4 text-sm font-medium text-zinc-100 transition hover:bg-white/[0.12] disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {emailAction === "verify" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        <span>{emailAction === "verify" ? "Verifying..." : "Verify code"}</span>
                      </button>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={resetEmailFlow}
                        className="text-sm font-medium text-zinc-400 transition hover:text-zinc-200"
                      >
                        Change email
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!ready || emailAction) return;
                          setEmailAction("send");
                          try {
                            await resendEmailCode(emailAddress, { mode, password: emailPassword });
                            toast.success("Verification code resent.");
                          } catch (error) {
                            const message = error instanceof Error ? error.message : "Unable to resend verification code.";
                            console.error("Failed to resend Clerk verification code.", error);
                            toast.error(message);
                          } finally {
                            setEmailAction(null);
                          }
                        }}
                        disabled={emailAction !== null || !ready}
                        className="inline-flex h-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.08] px-4 text-sm font-medium text-zinc-100 transition hover:bg-white/[0.12] disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {emailAction === "send" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        <span>{emailAction === "send" ? "Resending..." : "Resend code"}</span>
                      </button>
                    </div>
                  </div>
                )}
              </form>
            ) : null}

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
