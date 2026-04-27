import { z } from 'zod';
import { getOpenAIClient, getOpenAIModel } from '@/server/openai-client';

type GenerateInput = {
  productName: string;
  productDescription: string;
  sellingPoints: string;
  targetAudience: string;
  durationSeconds: number;
  language: 'en' | 'es';
  promoEnabled: boolean;
  promoInfo: unknown;
};

export type GeneratedScript = {
  styleLabel: string;
  hookText: string;
  bodyText: string;
  ctaText: string;
  estimatedDurationSeconds: number;
};

const scriptItemSchema = z.object({
  styleLabel: z.string().trim().min(1).max(80),
  hookText: z.string().trim().min(10).max(500),
  bodyText: z.string().trim().min(20).max(1200),
  ctaText: z.string().trim().min(5).max(300),
  estimatedDurationSeconds: z.number().int().min(15).max(180),
});

const scriptResponseSchema = z.object({
  scripts: z.array(scriptItemSchema).length(3),
});

function compactText(value: string, maxLength: number) {
  return value.replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function normalizePromoInfo(promoEnabled: boolean, promoInfo: unknown) {
  if (!promoEnabled || !promoInfo || typeof promoInfo !== 'object') return null;

  const raw = promoInfo as Record<string, unknown>;
  return {
    originalPrice: typeof raw.originalPrice === 'string' ? compactText(raw.originalPrice, 80) : '',
    salePrice: typeof raw.salePrice === 'string' ? compactText(raw.salePrice, 80) : '',
    offerText: typeof raw.offerText === 'string' ? compactText(raw.offerText, 160) : '',
  };
}

function buildPrompt(input: GenerateInput) {
  const languageName = input.language === 'es' ? 'Spanish' : 'English';
  const promo = normalizePromoInfo(input.promoEnabled, input.promoInfo);

  return [
    `Generate exactly 3 short ecommerce ad script variants in ${languageName}.`,
    `Each script must fit a ${input.durationSeconds}-second short-form video.`,
    'The output must feel conversion-focused, clear, and native to paid social creative.',
    'Avoid generic filler, hashtags, emoji, markdown, and commentary.',
    'Each script must include a distinct angle and a concise CTA.',
    '',
    `Product name: ${compactText(input.productName, 120)}`,
    `Product description: ${compactText(input.productDescription, 1500)}`,
    `Selling points: ${compactText(input.sellingPoints, 1500)}`,
    `Target audience: ${compactText(input.targetAudience, 500)}`,
    ...(promo
      ? [
          `Promotion original price: ${promo.originalPrice || 'N/A'}`,
          `Promotion sale price: ${promo.salePrice || 'N/A'}`,
          `Promotion offer text: ${promo.offerText || 'N/A'}`,
        ]
      : ['Promotion: none']),
    '',
    'Return valid JSON with this exact shape:',
    '{"scripts":[{"styleLabel":"...","hookText":"...","bodyText":"...","ctaText":"...","estimatedDurationSeconds":30}]}',
  ].join('\n');
}

export async function generateProjectScripts(input: GenerateInput): Promise<GeneratedScript[]> {
  const client = getOpenAIClient();
  const model = getOpenAIModel();
  const completion = await client.chat.completions.create({
    model,
    temperature: 0.9,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content:
          'You are a senior direct-response ad copywriter. Write concise, high-conversion short video ad scripts and return JSON only.',
      },
      {
        role: 'user',
        content: buildPrompt(input),
      },
    ],
  });

  const rawContent = completion.choices[0]?.message?.content;
  if (!rawContent) {
    throw new Error('OpenAI returned empty script content');
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawContent);
  } catch {
    throw new Error('OpenAI returned invalid JSON for script generation');
  }

  const parsed = scriptResponseSchema.safeParse(parsedJson);
  if (!parsed.success) {
    throw new Error(`OpenAI script payload validation failed: ${parsed.error.issues[0]?.message || 'Invalid payload'}`);
  }

  return parsed.data.scripts.map((script) => ({
    styleLabel: script.styleLabel,
    hookText: script.hookText,
    bodyText: script.bodyText,
    ctaText: script.ctaText,
    estimatedDurationSeconds: Math.min(input.durationSeconds, script.estimatedDurationSeconds),
  }));
}
