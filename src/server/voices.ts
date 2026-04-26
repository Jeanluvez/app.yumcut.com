import { prisma } from './db';
import { VOICE_PROVIDER_IDS, VOICE_PROVIDER_PRIORITY } from '@/shared/constants/voice-providers';

const VOICE_ORDER_BY = [
  { weight: 'desc' },
  { createdAt: 'asc' },
];

function getTemplateVoiceDelegate() {
  const delegate = (prisma as any).templateVoice;
  return delegate && typeof delegate.findFirst === 'function' && typeof delegate.findMany === 'function'
    ? delegate
    : null;
}

export async function listPublicVoices(options?: { allowedProviders?: ReadonlySet<string> }) {
  const templateVoice = getTemplateVoiceDelegate();
  if (!templateVoice) {
    return [];
  }
  const allowedProviders = options?.allowedProviders;
  const providerFilter = allowedProviders ? Array.from(allowedProviders) : null;
  return templateVoice.findMany({
    where: {
      isPublic: true,
      ...(providerFilter ? { voiceProvider: { in: providerFilter } } : {}),
    },
    orderBy: VOICE_ORDER_BY,
    select: {
      id: true,
      title: true,
      description: true,
      externalId: true,
      languages: true,
      speed: true,
      gender: true,
      previewPath: true,
      voiceProvider: true,
      weight: true,
    },
  });
}

export async function getDefaultVoiceExternalId(
  options?: { allowedProviders?: ReadonlySet<string> }
): Promise<string | null> {
  const templateVoice = getTemplateVoiceDelegate();
  if (!templateVoice) {
    return null;
  }
  const allowedProviders = options?.allowedProviders ?? new Set(VOICE_PROVIDER_IDS);
  if (allowedProviders.size === 0) return null;
  const filteredPriority = VOICE_PROVIDER_PRIORITY.filter((provider) => allowedProviders.has(provider));
  for (const provider of filteredPriority) {
    const prioritized = await templateVoice.findFirst({
      where: {
        isPublic: true,
        voiceProvider: provider,
        gender: 'female',
        speed: 'fast',
        externalId: { not: null },
      },
      orderBy: VOICE_ORDER_BY,
    });
    if (prioritized?.externalId) return prioritized.externalId;
  }

  for (const provider of filteredPriority) {
    const fallback = await templateVoice.findFirst({
      where: { isPublic: true, voiceProvider: provider, externalId: { not: null } },
      orderBy: VOICE_ORDER_BY,
    });
    if (fallback?.externalId) return fallback.externalId;
  }

  return null;
}

export async function resolveVoiceInfo(
  input: string,
  options?: { allowedProviders?: ReadonlySet<string> }
): Promise<{ externalId: string; voiceProvider: string | null } | null> {
  const templateVoice = getTemplateVoiceDelegate();
  if (!templateVoice) {
    return null;
  }
  if (!input) return null;
  const normalized = input.trim();
  if (!normalized) return null;
  const voice = await templateVoice.findFirst({
    where: {
      OR: [
        { isPublic: true, externalId: normalized },
        { isPublic: true, id: normalized },
        { externalId: normalized },
        { id: normalized },
      ],
    },
    select: { externalId: true, voiceProvider: true },
  });
  if (!voice?.externalId) return null;
  const provider = voice.voiceProvider ?? null;
  if (options?.allowedProviders && provider) {
    const allowed = options.allowedProviders;
    if (!allowed.has(provider)) return null;
  } else if (options?.allowedProviders && !provider) {
    return null;
  }
  return { externalId: voice.externalId, voiceProvider: provider };
}

export async function resolveVoiceExternalId(
  input: string,
  options?: { allowedProviders?: ReadonlySet<string> }
): Promise<string | null> {
  const info = await resolveVoiceInfo(input, options);
  return info?.externalId ?? null;
}

export async function sanitizePreferredVoiceId(
  preferredVoiceId: string | null | undefined,
  options?: { allowedProviders?: ReadonlySet<string> }
): Promise<string | null> {
  if (!preferredVoiceId) return null;
  const resolved = await resolveVoiceInfo(preferredVoiceId, options);
  return resolved?.externalId ?? null;
}

export async function sanitizeLanguageVoicePreferences(
  preferences: Record<string, string | null>,
  options?: { allowedProviders?: ReadonlySet<string> }
): Promise<Record<string, string | null>> {
  const entries = Object.entries(preferences);
  const result: Record<string, string | null> = {};
  for (const [languageCode, voiceId] of entries) {
    if (typeof voiceId !== 'string' || !voiceId.trim()) {
      result[languageCode] = null;
      continue;
    }
    const resolved = await resolveVoiceInfo(voiceId, options);
    result[languageCode] = resolved?.externalId ?? null;
  }
  return result;
}

export async function isValidVoiceExternalId(externalId: string): Promise<boolean> {
  const templateVoice = getTemplateVoiceDelegate();
  if (!templateVoice) {
    return false;
  }
  if (!externalId) return false;
  const voice = await templateVoice.findFirst({
    where: { isPublic: true, externalId },
    select: { id: true },
  });
  return !!voice;
}
