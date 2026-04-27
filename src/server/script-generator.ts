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

type GeneratedScript = {
  styleLabel: string;
  hookText: string;
  bodyText: string;
  ctaText: string;
  estimatedDurationSeconds: number;
};

function compactText(value: string, maxLength: number) {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trim()}…`;
}

function promoLine(promoEnabled: boolean, promoInfo: unknown) {
  if (!promoEnabled || !promoInfo || typeof promoInfo !== 'object') return null;
  const raw = promoInfo as Record<string, unknown>;
  const originalPrice = typeof raw.originalPrice === 'string' ? raw.originalPrice.trim() : '';
  const salePrice = typeof raw.salePrice === 'string' ? raw.salePrice.trim() : '';
  const offerText = typeof raw.offerText === 'string' ? raw.offerText.trim() : '';
  const parts = [originalPrice, salePrice, offerText].filter(Boolean);
  return parts.length > 0 ? compactText(parts.join(' | '), 120) : null;
}

export function generateProjectScripts(input: GenerateInput): GeneratedScript[] {
  const productName = compactText(input.productName, 80);
  const description = compactText(input.productDescription, 180);
  const sellingPoints = compactText(input.sellingPoints, 180);
  const audience = compactText(input.targetAudience, 120);
  const promo = promoLine(input.promoEnabled, input.promoInfo);

  const baseDuration = input.durationSeconds;
  const ctaSuffix = promo ? ` ${promo}` : '';

  return [
    {
      styleLabel: 'Problem / Solution',
      hookText: `Still trying to solve this the hard way? ${productName} is built for ${audience}.`,
      bodyText: `${productName} helps with ${description} Focus on ${sellingPoints} without adding extra steps to the workflow.`,
      ctaText: `Try ${productName} now and turn attention into action.${ctaSuffix}`.trim(),
      estimatedDurationSeconds: baseDuration,
    },
    {
      styleLabel: 'Before & After',
      hookText: `Before ${productName}: too much friction. After ${productName}: a cleaner result in less time.`,
      bodyText: `If your audience is ${audience}, lead with the outcome. ${productName} highlights ${sellingPoints} and makes the value obvious fast.`,
      ctaText: `See the difference for yourself with ${productName}.${ctaSuffix}`.trim(),
      estimatedDurationSeconds: baseDuration,
    },
    {
      styleLabel: 'Social Proof Angle',
      hookText: `${audience} keep choosing ${productName} for one reason: it gets to the point fast.`,
      bodyText: `Open with the pain, show the product, then land the proof. ${description} The strongest conversion angles here are ${sellingPoints}.`,
      ctaText: `Use ${productName} in your next campaign and push for a faster decision.${ctaSuffix}`.trim(),
      estimatedDurationSeconds: baseDuration,
    },
  ];
}
