import { NextRequest } from 'next/server';
import { getAuthSession } from '@/server/auth';
import { ok, unauthorized, error } from '@/server/http';
import { withApiError } from '@/server/errors';
import { patchSettingsSchema } from '@/server/validators/settings';
import { ensureSchedulerPreferences } from '@/server/publishing/preferences';

function buildDefaultSettings(isAuthenticated: boolean) {
  const scheduler = ensureSchedulerPreferences();
  return {
    includeDefaultMusic: true,
    addOverlay: true,
    includeCallToAction: true,
    autoApproveScript: true,
    autoApproveAudio: true,
    watermarkEnabled: true,
    captionsEnabled: true,
    projectCreationEnabled: true,
    projectCreationDisabledReason: '',
    defaultDurationSeconds: null,
    sidebarOpen: isAuthenticated,
    defaultUseScript: false,
    targetLanguages: ['en'],
    languageVoicePreferences: {},
    scriptCreationGuidanceEnabled: false,
    scriptCreationGuidance: '',
    scriptAvoidanceGuidanceEnabled: false,
    scriptAvoidanceGuidance: '',
    audioStyleGuidanceEnabled: false,
    audioStyleGuidance: '',
    characterSelection: null,
    preferredVoiceId: null,
    preferredTemplateId: null,
    schedulerDefaultTimes: scheduler.times,
    schedulerCadence: scheduler.cadence,
  };
}

export const GET = withApiError(async function GET() {
  const session = await getAuthSession();
  return ok(buildDefaultSettings(!!session?.user));
}, 'Failed to load settings');

export const PATCH = withApiError(async function PATCH(req: NextRequest) {
  const session = await getAuthSession();
  if (!session?.user?.email || !(session.user as any).id) return unauthorized();

  const parsed = patchSettingsSchema.safeParse(await req.json());
  if (!parsed.success) {
    return error('VALIDATION_ERROR', 'Invalid settings payload', 400, parsed.error.flatten());
  }

  const defaults = buildDefaultSettings(true) as Record<string, unknown>;
  const { key, value } = parsed.data as { key: string; value: unknown };
  return ok({ [key]: value ?? defaults[key] ?? null });
}, 'Failed to update settings');
