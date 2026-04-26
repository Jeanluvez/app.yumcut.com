import { NextRequest } from 'next/server';
import { getAuthSession } from '@/server/auth';
import { ok, unauthorized } from '@/server/http';
import { withApiError } from '@/server/errors';
import { TOKEN_COSTS, MINIMUM_PROJECT_TOKENS } from '@/shared/constants/token-costs';
import { prisma } from '@/server/db';

export const GET = withApiError(async function GET(_req: NextRequest) {
  const session = await getAuthSession();
  if (!session?.user || !(session.user as any).id) return unauthorized();
  const userId = (session.user as any).id as string;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { generationCountThisMonth: true },
  }).catch(() => null);
  return ok({
    balance: Number(user?.generationCountThisMonth ?? 0),
    perSecondProject: TOKEN_COSTS.perSecondProject,
    minimumProjectTokens: MINIMUM_PROJECT_TOKENS,
    minimumProjectSeconds: TOKEN_COSTS.minimumProjectSeconds,
    actionCosts: TOKEN_COSTS.actions,
    signUpBonus: TOKEN_COSTS.signUpBonus,
  });
}, 'Failed to load token summary');
