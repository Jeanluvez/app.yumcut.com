import { NextRequest } from 'next/server';
import { z } from 'zod';
import { authenticateApiRequest } from '@/server/api-user';
import { prisma } from '@/server/db';
import { conflict, error, notFound, ok, unauthorized } from '@/server/http';
import { withApiError } from '@/server/errors';
import { generateProjectScripts } from '@/server/script-generator';

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
    return error('VALIDATION_ERROR', 'Invalid script generation payload', 400, parsed.error.flatten());
  }

  const { projectId } = await params;
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId: auth.userId },
    select: {
      id: true,
      productName: true,
      productDescription: true,
      sellingPoints: true,
      targetAudience: true,
      durationSeconds: true,
      language: true,
      promoEnabled: true,
      promoInfo: true,
      _count: {
        select: { scripts: true },
      },
    },
  });
  if (!project) return notFound('Project not found');

  if (project._count.scripts > 0 && !parsed.data.overwrite) {
    return conflict('Scripts already exist for this project');
  }

  const generated = generateProjectScripts({
    productName: project.productName,
    productDescription: project.productDescription,
    sellingPoints: project.sellingPoints,
    targetAudience: project.targetAudience,
    durationSeconds: project.durationSeconds,
    language: project.language,
    promoEnabled: project.promoEnabled,
    promoInfo: project.promoInfo,
  });

  const scripts = await prisma.$transaction(async (tx) => {
    if (project._count.scripts > 0) {
      await tx.videoJob.deleteMany({ where: { projectId: project.id } });
      await tx.script.deleteMany({ where: { projectId: project.id } });
    }

    const created = await Promise.all(
      generated.map((item, index) =>
        tx.script.create({
          data: {
            projectId: project.id,
            styleLabel: item.styleLabel,
            hookText: item.hookText,
            bodyText: item.bodyText,
            ctaText: item.ctaText,
            estimatedDurationSeconds: item.estimatedDurationSeconds,
            originalHookText: item.hookText,
            originalBodyText: item.bodyText,
            originalCtaText: item.ctaText,
            isSelected: true,
            sortOrder: index + 1,
          },
          select: {
            id: true,
            styleLabel: true,
            hookText: true,
            bodyText: true,
            ctaText: true,
            estimatedDurationSeconds: true,
            isSelected: true,
            sortOrder: true,
            createdAt: true,
          },
        }),
      ),
    );

    await tx.project.update({
      where: { id: project.id },
      data: { status: 'scripts_generated' },
    });

    return created;
  });

  return ok({
    scripts: scripts.map((script) => ({
      id: script.id,
      styleLabel: script.styleLabel,
      hookText: script.hookText,
      bodyText: script.bodyText,
      ctaText: script.ctaText,
      estimatedDurationSeconds: script.estimatedDurationSeconds,
      isSelected: script.isSelected,
      sortOrder: script.sortOrder,
      createdAt: script.createdAt.toISOString(),
    })),
  }, { status: 201 });
}, 'Failed to generate scripts');
