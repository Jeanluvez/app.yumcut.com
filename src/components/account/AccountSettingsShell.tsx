"use client";

import Link from 'next/link';
import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

type SectionId = 'account' | 'subscription';

type AccountSettingsShellProps = {
  name: string;
  email: string;
  userId: string;
  createdLabel: string;
  plan: string;
  generationCountLabel: string;
  resetLabel: string;
  storageUsedLabel: string;
};

function DetailRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-zinc-800 bg-zinc-950/80 px-4 py-3">
      <div className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">{label}</div>
      <div className={cn('text-sm leading-6 text-zinc-100', mono && 'break-all font-mono text-xs text-zinc-300')}>{value}</div>
    </div>
  );
}

export function AccountSettingsShell({
  name,
  email,
  userId,
  createdLabel,
  plan,
  generationCountLabel,
  resetLabel,
  storageUsedLabel,
}: AccountSettingsShellProps) {
  const [activeSection, setActiveSection] = useState<SectionId>('account');

  const sections = [
    {
      id: 'account' as const,
      label: 'Account Info',
    },
    {
      id: 'subscription' as const,
      label: 'Subscription',
    },
  ];

  return (
    <div className="mx-auto grid w-full max-w-7xl items-start gap-6 text-zinc-100 xl:grid-cols-[220px_minmax(0,1fr)]">
      <div className="xl:sticky xl:top-6 xl:self-start">
        <div className="mb-4 flex items-center gap-3">
          <Link
            href="/workspace"
            aria-label="Back to workspace"
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl text-zinc-300 transition hover:bg-zinc-900 hover:text-zinc-100"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0 text-xl font-semibold tracking-tight text-zinc-100">
            <span className="block truncate">Settings</span>
          </div>
        </div>

        <div className="rounded-[28px] border border-zinc-800 bg-zinc-900/70 text-zinc-100">
          <div className="space-y-3 p-4">
            {sections.map((section) => {
              const active = activeSection === section.id;
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => setActiveSection(section.id)}
                  className={cn(
                    'w-full rounded-2xl border px-4 py-3 text-left transition',
                    active
                      ? 'border-blue-500/50 bg-blue-500/10'
                      : 'border-zinc-800 bg-zinc-950/70 hover:border-zinc-700',
                  )}
                >
                  <div className="text-sm font-medium text-zinc-100">{section.label}</div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {activeSection === 'account' ? (
          <div className="rounded-[28px] border border-zinc-800 bg-zinc-900/70 text-zinc-100">
            <div className="flex flex-col items-start gap-2 px-6 py-5 sm:px-7">
              <div className="text-xl font-semibold tracking-tight text-zinc-100">Account Info</div>
              <div className="text-sm text-zinc-400">Core account details used to identify and manage this workspace.</div>
            </div>
            <div className="grid gap-4 px-6 pb-6 sm:grid-cols-2 sm:px-7 sm:pb-7">
              <DetailRow label="Name" value={name} />
              <DetailRow label="Email" value={email} />
              <DetailRow label="User ID" value={userId} mono />
              <DetailRow label="Created" value={createdLabel} />
            </div>
          </div>
        ) : null}

        {activeSection === 'subscription' ? (
          <div className="rounded-[28px] border border-zinc-800 bg-zinc-900/70 text-zinc-100">
            <div className="flex flex-col items-start gap-2 px-6 py-5 sm:px-7">
              <div className="text-xl font-semibold tracking-tight text-zinc-100">Subscription</div>
              <div className="text-sm text-zinc-400">Plan and usage details that define your current subscription status.</div>
            </div>
            <div className="grid gap-4 px-6 pb-6 sm:grid-cols-2 sm:px-7 sm:pb-7">
              <DetailRow label="Current Plan" value={plan.charAt(0).toUpperCase() + plan.slice(1)} />
              <DetailRow label="Monthly Generations Used" value={generationCountLabel} />
              <DetailRow label="Counter Resets" value={resetLabel} />
              <DetailRow label="Storage Used" value={storageUsedLabel} />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
