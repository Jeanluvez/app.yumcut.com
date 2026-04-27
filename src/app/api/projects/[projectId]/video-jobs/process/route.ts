import { NextRequest } from 'next/server';
import { authenticateApiRequest } from '@/server/api-user';
import { prisma } from '@/server/db';
import { notFound, ok, unauthorized } from '@/server/http';
import { withApiError } from '@/server/errors';
import { processNextPendingVideoJob } from '@/server/video-jobs/worker';

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
