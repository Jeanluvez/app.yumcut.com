import { z } from 'zod';
import { LIMITS } from '@/server/limits';
import { LANGUAGE_CODES, LANGUAGE_ENUM } from '@/shared/constants/languages';
const scriptTextSchema = z
  .string()
  .trim()
  .min(LIMITS.approvedScriptMin, { message: `Approved script must be at least ${LIMITS.approvedScriptMin} characters` })
  .max(LIMITS.rawScriptMax, { message: `Script must be at most ${LIMITS.rawScriptMax} characters` });

const staticCharacterSelectionSchema = z.object({
  characterId: z.string().uuid().optional(),
  userCharacterId: z.string().uuid().optional(),
  variationId: z.string().uuid().optional(),
}).partial().strict();

export const characterSelectionSchema = z.union([
  staticCharacterSelectionSchema,
  z.object({
    source: z.literal('dynamic'),
  }),
]);

const languageVoiceIdSchema = z.string().min(1).max(128);
const languageVoiceRecordSchema = z.record(z.string(), languageVoiceIdSchema).superRefine((val, ctx) => {
  if (!val || typeof val !== 'object') return;
  for (const key of Object.keys(val)) {
    if (!LANGUAGE_CODES.includes(key as typeof LANGUAGE_CODES[number])) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Unsupported language code "${key}"`,
        path: ['languageVoices', key],
      });
    }
  }
});

export const createProjectSchema = z.object({
  prompt: z
    .string()
    .trim()
    .min(1, { message: 'Prompt cannot be empty' })
    .max(LIMITS.promptMax, { message: `Prompt must be at most ${LIMITS.promptMax} characters` })
    .optional(),
  rawScript: z
    .string()
    .trim()
    .min(1, { message: 'Script cannot be empty' })
    .max(LIMITS.rawScriptMax, { message: `Script must be at most ${LIMITS.rawScriptMax} characters` })
    .optional(),
  // Allow custom seconds in [30, 1800] (30s .. 30m)
  durationSeconds: z.number().int().min(30, { message: 'Minimum duration is 30 seconds' }).max(1800, { message: 'Maximum duration is 30 minutes' }).optional(),
  characterSelection: characterSelectionSchema.optional(),
  useExactTextAsScript: z.boolean().optional(),
  templateId: z.string().uuid().optional(),
  voiceId: z.string().max(128).optional().or(z.literal('')).transform((v) => v || undefined),
  languages: z
    .array(LANGUAGE_ENUM)
    .min(1, { message: 'Select at least one language' })
    .optional(),
  languageVoices: languageVoiceRecordSchema.optional(),
}).superRefine((val, ctx) => {
  // If not using exact script mode, duration is required
  if (!val.useExactTextAsScript && (val.durationSeconds == null)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Duration is required', path: ['durationSeconds'] });
  }
});

export const createSproklProjectSchema = z.object({
  name: z.string().trim().min(1, { message: 'Project name is required' }).max(120, { message: 'Project name must be at most 120 characters' }),
  productName: z.string().trim().min(1, { message: 'Product name is required' }).max(120, { message: 'Product name must be at most 120 characters' }),
  productDescription: z.string().trim().min(10, { message: 'Product description must be at least 10 characters' }).max(2000, { message: 'Product description must be at most 2000 characters' }),
  sellingPoints: z.string().trim().min(10, { message: 'Selling points must be at least 10 characters' }).max(2000, { message: 'Selling points must be at most 2000 characters' }),
  targetAudience: z.string().trim().min(3, { message: 'Target audience is required' }).max(500, { message: 'Target audience must be at most 500 characters' }),
  durationSeconds: z.union([z.literal(30), z.literal(60), z.literal(90)]),
  language: z.union([z.literal('en'), z.literal('es')]).default('en'),
  aspectRatio: z.enum(['vertical_9_16', 'square_1_1', 'landscape_16_9']).default('vertical_9_16'),
});

export const approveScriptSchema = z.union([
  z.object({
    scripts: z
      .array(
        z.object({
          languageCode: LANGUAGE_ENUM,
          text: scriptTextSchema,
        }),
      )
      .min(1, { message: 'Provide at least one script' }),
  }),
  z.object({
    text: scriptTextSchema,
    languageCode: LANGUAGE_ENUM.optional(),
  }),
]);

const finalScriptEditTextSchema = z
  .string()
  .trim()
  .min(1, { message: 'Script cannot be empty' })
  .max(LIMITS.rawScriptMax, { message: `Script must be at most ${LIMITS.rawScriptMax} characters` });

export const finalScriptEditSchema = z.object({
  text: finalScriptEditTextSchema,
  languageCode: LANGUAGE_ENUM.optional(),
});

export const approveAudioSchema = z.union([
  z.object({
    selections: z
      .array(
        z.object({
          languageCode: LANGUAGE_ENUM,
          audioId: z.string().uuid(),
        }),
      )
      .min(1, { message: 'Provide at least one audio selection' }),
  }),
  z.object({
    audioId: z.string().uuid(),
  }),
]);

export const textRequestSchema = z.object({
  text: z.string().min(1),
  languageCode: LANGUAGE_ENUM.optional(),
  propagateTranslations: z.boolean().default(true),
});
