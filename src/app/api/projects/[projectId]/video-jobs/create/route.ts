import { NextRequest } from 'next/server';
import { z } from 'zod';
import { authenticateApiRequest } from '@/server/api-user';
import { prisma } from '@/server/db';
import { conflict, error, notFound, ok, unauthorized } from '@/server/http';
import { withApiError } from '@/server/errors';
import { getVideoGenerationAllowance } from '@/server/plan-limits';

type Params = { projectId: string };

const bodySchema = z.object({
  overwrite: z.boolean().default(true),
});

export const POST = withApiError(async function POST(req: NextRequest, { params }: { params: Promise<Params> }) {
  const auth = await authenticateApiRequest(req);
  if (!auth) return unauthorized();

  let json: unknown = {};
  try {
    const text = await req.text();
    json = text.trim().length > 0 ? JSON.parse(text) : {};
  } catch {
    return error('INVALID_JSON', 'Request body must be valid JSON', 400);
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return error('VALIDATION_ERROR', 'Invalid video job payload', 400, parsed.error.flatten());
  }

  const { projectId } = await params;
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId: auth.userId },
    select: {
      id: true,
      selectedAssetIds: true,
      hookAssetId: true,
      scripts: {
        where: { isSelected: true },
        orderBy: { sortOrder: 'asc' },
        select: { id: true, sortOrder: true, styleLabel: true },
      },
      videoJobs: {
        select: { id: true, status: true },
      },
    },
  });
  if (!project) return notFound('Project not found');

  if (project.scripts.length === 0) {
    return error('VALIDATION_ERROR', 'Generate and select at least one script first', 400);
  }

  const allowance = await getVideoGenerationAllowance(auth.userId);
  if (project.scripts.length > allowance.remaining) {
    return error(
      'PLAN_LIMIT_EXCEEDED',
      `Your ${allowance.plan} plan allows ${allowance.monthlyLimit} video generations per month. You have ${allowance.remaining} remaining this cycle.`,
      403,
      {
        plan: allowance.plan,
        monthlyLimit: allowance.monthlyLimit,
        used: allowance.used,
        remaining: allowance.remaining,
        resetsAt: allowance.resetsAt.toISOString(),
        requested: project.scripts.length,
      },
    );
  }

  const hasSourceMedia = project.selectedAssetIds.length > 0 || !!project.hookAssetId;
  if (!hasSourceMedia) {
    return error('VALIDATION_ERROR', 'Select at least one asset or hook video before creating jobs', 400);
  }

  const hasActiveJobs = project.videoJobs.some((job) => job.status === 'pending' || job.status === 'processing');
  if (hasActiveJobs && !parsed.data.overwrite) {
    return conflict('Active video jobs already exist for this project');
  }

  const jobs = await prisma.$transaction(async (tx) => {
    if (project.videoJobs.length > 0) {
      await tx.videoJob.deleteMany({ where: { projectId: project.id } });
    }

    const created = await Promise.all(
      project.scripts.map((script, index) =>
        tx.videoJob.create({
          data: {
            projectId: project.id,
            scriptId: script.id,
            variantIndex: index + 1,
            status: 'pending',
          },
          select: {
            id: true,
            scriptId: true,
            variantIndex: true,
            status: true,
            retryCount: true,
            errorMessage: true,
            createdAt: true,
            script: {
              select: {
                styleLabel: true,
                sortOrder: true,
              },
            },
          },
        }),
      ),
    );

    await tx.project.update({
      where: { id: project.id },
      data: { status: 'generating' },
    });

    return created;
  });

  return ok({
    jobs: jobs.map((job) => ({
      id: job.id,
      scriptId: job.scriptId,
      variantIndex: job.variantIndex,
      status: job.status,
      retryCount: job.retryCount,
      errorMessage: job.errorMessage,
      styleLabel: job.script.styleLabel,
      sortOrder: job.script.sortOrder,
      createdAt: job.createdAt.toISOString(),
    })),
  }, { status: 201 });
}, 'Failed to create video jobs');
