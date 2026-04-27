import { NextRequest } from 'next/server';
import { authenticateApiRequest } from '@/server/api-user';
import { prisma } from '@/server/db';
import { error, notFound, ok, unauthorized } from '@/server/http';
import { withApiError } from '@/server/errors';
import { processNextPendingVideoJob } from '@/server/video-jobs/worker';
import { getVideoGenerationAllowance } from '@/server/plan-limits';

type Params = { projectId: string };

export const POST = withApiError(async function POST(req: NextRequest, { params }: { params: Promise<Params> }) {
  const auth = await authenticateApiRequest(req);
  if (!auth) return unauthorized();

  const { projectId } = await params;
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId: auth.userId },
    select: { id: true },
  });
  if (!project) return notFound('Project not found');

  const allowance = await getVideoGenerationAllowance(auth.userId);
  if (allowance.remaining <= 0) {
    return error(
      'PLAN_LIMIT_EXCEEDED',
      `Your ${allowance.plan} plan has reached its monthly video generation limit of ${allowance.monthlyLimit}.`,
      403,
      {
        plan: allowance.plan,
        monthlyLimit: allowance.monthlyLimit,
        used: allowance.used,
        remaining: allowance.remaining,
        resetsAt: allowance.resetsAt.toISOString(),
      },
    );
  }

  const processed = await processNextPendingVideoJob(project.id);
  return ok({
    processed: processed
      ? [
          {
            id: processed.id,
            status: processed.status,
            variantIndex: processed.variantIndex,
          },
        ]
      : [],
  });
}, 'Failed to process video jobs');
