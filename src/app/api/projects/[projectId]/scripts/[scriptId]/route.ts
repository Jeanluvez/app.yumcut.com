import { NextRequest } from 'next/server';
import { authenticateApiRequest } from '@/server/api-user';
import { prisma } from '@/server/db';
import { error, notFound, ok, unauthorized } from '@/server/http';
import { withApiError } from '@/server/errors';
import { updateProjectScriptSchema } from '@/server/validators/projects';

type Params = {
  projectId: string;
  scriptId: string;
};

export const PATCH = withApiError(async function PATCH(req: NextRequest, { params }: { params: Promise<Params> }) {
  const auth = await authenticateApiRequest(req);
  if (!auth) return unauthorized();

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return error('INVALID_JSON', 'Request body must be valid JSON', 400);
  }

  const parsed = updateProjectScriptSchema.safeParse(json);
  if (!parsed.success) {
    return error('VALIDATION_ERROR', 'Invalid script update payload', 400, parsed.error.flatten());
  }

  const { projectId, scriptId } = await params;
  const script = await prisma.script.findFirst({
    where: {
      id: scriptId,
      projectId,
      project: {
        userId: auth.userId,
      },
    },
    select: {
      id: true,
      projectId: true,
    },
  });

  if (!script) return notFound('Script not found');

  const now = new Date();
  const updated = await prisma.$transaction(async (tx) => {
    const nextScript = await tx.script.update({
      where: { id: script.id },
      data: {
        styleLabel: parsed.data.styleLabel,
        hookText: parsed.data.hookText,
        bodyText: parsed.data.bodyText,
        ctaText: parsed.data.ctaText,
        isSelected: parsed.data.isSelected,
        editedAt: now,
      },
      select: {
        id: true,
        projectId: true,
        styleLabel: true,
        hookText: true,
        bodyText: true,
        ctaText: true,
        isSelected: true,
        sortOrder: true,
        editedAt: true,
      },
    });

    await tx.videoJob.deleteMany({
      where: { projectId: script.projectId },
    });

    await tx.project.update({
      where: { id: script.projectId },
      data: { status: 'scripts_generated' },
    });

    return nextScript;
  });

  return ok({
    id: updated.id,
    projectId: updated.projectId,
    styleLabel: updated.styleLabel,
    hookText: updated.hookText,
    bodyText: updated.bodyText,
    ctaText: updated.ctaText,
    isSelected: updated.isSelected,
    sortOrder: updated.sortOrder,
    editedAt: updated.editedAt?.toISOString() ?? null,
  });
}, 'Failed to update script');
