import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/server/db';
import { config } from '@/server/config';
import { error, ok } from '@/server/http';
import { withApiError } from '@/server/errors';

  const statusSchema = z.object({
    jobId: z.string().min(1).optional(),
    taskId: z.string().min(1).optional(),
    status: z.enum(['pending', 'processing', 'done', 'failed']),
    outputUrl: z.string().url().optional(),
    outputPath: z.string().min(1).optional(),
    fileSizeBytes: z.number().int().nonnegative().optional(),
    durationSeconds: z.number().int().positive().optional(),
    variantLabel: z.string().min(1).optional(),
    errorMessage: z.string().min(1).optional(),
    message: z.string().min(1).optional(),
  });

function isAuthorized(req: NextRequest) {
  const expected = config.VIDEO_JOB_STATUS_WEBHOOK_SECRET;
  if (!expected) return false;

  const bearer = req.headers.get('authorization');
  if (bearer && bearer.trim() === `Bearer ${expected}`) {
    return true;
  }

  const headerSecret =
    req.headers.get('x-sprokl-worker-secret') ||
    req.headers.get('x-worker-secret') ||
    req.headers.get('x-railway-worker-secret');

  return !!headerSecret && headerSecret === expected;
}

async function updateProjectStatus(projectId: string) {
  const jobs = await prisma.videoJob.findMany({
    where: { projectId },
    select: { status: true },
  });

  if (jobs.length === 0) return;

  const hasActive = jobs.some((job) => job.status === 'pending' || job.status === 'processing');
  if (hasActive) {
    await prisma.project.update({
      where: { id: projectId },
      data: { status: 'generating' },
    });
    return;
  }

  const hasFailure = jobs.some((job) => job.status === 'failed');
  await prisma.project.update({
    where: { id: projectId },
    data: { status: hasFailure ? 'failed' : 'done' },
  });
}

export const POST = withApiError(async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return error('UNAUTHORIZED', 'Unauthorized', 401);
  }

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    return error('INVALID_JSON', 'Request body must be valid JSON', 400);
  }

  const parsed = statusSchema.safeParse(body);
  if (!parsed.success) {
    return error('VALIDATION_ERROR', 'Invalid worker status payload', 400, parsed.error.flatten());
  }

  const payload = parsed.data;
  const lookupId = payload.jobId || payload.taskId;
  if (!lookupId) {
    return error('VALIDATION_ERROR', 'jobId is required', 400);
  }

  const job = await prisma.videoJob.findUnique({
    where: { id: lookupId },
    select: {
      id: true,
      projectId: true,
      status: true,
      variantIndex: true,
      project: {
        select: {
          userId: true,
          durationSeconds: true,
        },
      },
      script: {
        select: {
          styleLabel: true,
        },
      },
    },
  });
  if (!job) {
    return error('NOT_FOUND', 'Video job not found', 404);
  }

  const now = new Date();
  const updateData: Record<string, unknown> = { status: payload.status };
  if (payload.status === 'processing') {
    updateData.startedAt = now;
    updateData.errorMessage = null;
  }
  if (payload.status === 'done') {
    updateData.completedAt = now;
    updateData.finalUrl = payload.outputUrl ?? undefined;
    updateData.errorMessage = null;
  }
  if (payload.status === 'failed') {
    updateData.completedAt = now;
    updateData.errorMessage = payload.errorMessage || payload.message || 'Worker failed to process job';
  }

  await prisma.videoJob.update({
    where: { id: job.id },
    data: updateData,
  });

  if (payload.status === 'done' && payload.outputUrl) {
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    await prisma.video.upsert({
      where: { jobId: job.id },
      update: {
        storageUrl: payload.outputUrl,
        thumbnailUrl: null,
        durationSeconds: payload.durationSeconds || job.project.durationSeconds,
        fileSizeBytes: BigInt(payload.fileSizeBytes || 0),
        variantLabel: payload.variantLabel || job.script.styleLabel || `Variant ${job.variantIndex}`,
        expiresAt,
      },
      create: {
        jobId: job.id,
        userId: job.project.userId,
        projectId: job.projectId,
        storageUrl: payload.outputUrl,
        thumbnailUrl: null,
        durationSeconds: payload.durationSeconds || job.project.durationSeconds,
        fileSizeBytes: BigInt(payload.fileSizeBytes || 0),
        variantLabel: payload.variantLabel || job.script.styleLabel || `Variant ${job.variantIndex}`,
        expiresAt,
      },
    });
  }

  await updateProjectStatus(job.projectId);

  return ok({
    ok: true,
    jobId: job.id,
    projectId: job.projectId,
    status: payload.status,
  });
}, 'Failed to update worker task status');
