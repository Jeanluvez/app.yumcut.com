import { ProjectConfirmation } from '@/components/create/ProjectConfirmation';
import { CheckCheck, FileSearch, Send } from 'lucide-react';

const CONFIRM_STEPS = [
  {
    label: 'Draft prepared',
    description: 'The create page stored your current task draft locally and passed it into the existing confirmation flow.',
    icon: FileSearch,
  },
  {
    label: 'Review settings',
    description: 'Confirm script mode, guidance, voices, languages, and template choices before the project is created.',
    icon: CheckCheck,
  },
  {
    label: 'Submit task',
    description: 'Once confirmed, Sprokl uses the current create-project path and continues into the downstream pipeline.',
    icon: Send,
  },
];

export function CreateConfirmationShell({ draftId }: { draftId: string }) {
  return (
    <div className="-m-4 min-h-[calc(100vh-65px)] overflow-hidden bg-zinc-950 text-zinc-100 sm:-m-6">
      <div className="absolute inset-0 hero-grid opacity-35" />
      <div className="absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top,rgba(96,165,250,0.2),transparent_65%)]" />
      <div className="relative mx-auto min-h-[calc(100vh-65px)] max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 rounded-[28px] border border-white/8 bg-white/4 p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-200/80">Create Video Task</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">Review the task before creation</h1>
              <p className="mt-2 text-sm leading-6 text-zinc-300">
                This page is still powered by the existing Sprokl confirmation logic. The first migration only upgrades the
                presentation and keeps the current submit path unchanged.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 lg:w-[420px] lg:grid-cols-1">
              {CONFIRM_STEPS.map(({ label, description, icon: Icon }, index) => (
                <div key={label} className="rounded-2xl border border-white/8 bg-black/20 p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-white/8 text-blue-200">
                      <Icon className="h-4 w-4" />
                    </div>
                    <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                      0{index + 1}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-white">{label}</p>
                  <p className="mt-1 text-sm leading-6 text-zinc-400">{description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <ProjectConfirmation draftId={draftId} />
      </div>
    </div>
  );
}
