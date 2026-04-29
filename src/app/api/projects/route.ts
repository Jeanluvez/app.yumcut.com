import { NextRequest } from 'next/server';
import { withApiError } from '@/server/errors';
import { authenticateApiRequest } from '@/server/api-user';
import { prisma } from '@/server/db';
import { error, ok, unauthorized } from '@/server/http';
import { createSproklProjectSchema } from '@/server/validators/projects';

export const GET = withApiError(async function GET(req: NextRequest) {
  const auth = await authenticateApiRequest(req);
  if (!auth) return unauthorized();

  const projects = await prisma.project.findMany({
    where: { userId: auth.userId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      status: true,
      promoInfo: true,
      createdAt: true,
    },
  });

  return ok(
    projects.map((project) => ({
      id: project.id,
      title: project.name,
      status: project.status,
      publishQueue:
        project.promoInfo &&
        typeof project.promoInfo === 'object' &&
        'publishQueue' in project.promoInfo &&
        Array.isArray((project.promoInfo as { publishQueue?: unknown[] }).publishQueue)
          ? (project.promoInfo as {
              publishQueue?: Array<{
                id?: string;
                videoId?: string;
                platform?: 'tiktok' | 'instagram_reels' | 'youtube_shorts';
                title?: string;
                description?: string;
                publishAt?: string;
                status?: 'draft' | 'scheduled' | 'published' | 'failed';
                publishedAt?: string | null;
                errorMessage?: string | null;
                createdAt?: string;
                updatedAt?: string;
              }>;
            }).publishQueue?.map((item) => ({
              id: item.id ?? '',
              videoId: item.videoId ?? '',
              platform: item.platform ?? 'tiktok',
              title: item.title ?? '',
              description: item.description ?? '',
              publishAt: item.publishAt ?? '',
              status:
                item.status === 'published'
                  ? 'published'
                  : item.status === 'failed'
                    ? 'failed'
                    : item.status === 'scheduled'
                      ? (item.publishAt && Date.parse(item.publishAt) <= Date.now() ? 'ready' : 'scheduled')
                      : 'draft',
              publishedAt: item.publishedAt ?? null,
              errorMessage: item.errorMessage ?? null,
              createdAt: item.createdAt ?? item.publishAt ?? '',
              updatedAt: item.updatedAt ?? item.publishAt ?? '',
            })) ?? []
          : [],
      createdAt: project.createdAt.toISOString(),
    })),
  );
}, 'Failed to list projects');

export const POST = withApiError(async function POST(req: NextRequest) {
  const auth = await authenticateApiRequest(req);
  if (!auth) return unauthorized();

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return error('INVALID_JSON', 'Request body must be valid JSON', 400);
  }

  const parsed = createSproklProjectSchema.safeParse(json);
  if (!parsed.success) {
    const first = parsed.error.issues?.[0]?.message || 'Invalid project payload';
    return error('VALIDATION_ERROR', first, 400, parsed.error.flatten());
  }

  const created = await prisma.project.create({
    data: {
      userId: auth.userId,
      name: parsed.data.name,
      productName: parsed.data.productName,
      productDescription: parsed.data.productDescription,
      sellingPoints: parsed.data.sellingPoints,
      targetAudience: parsed.data.targetAudience,
      durationSeconds: parsed.data.durationSeconds,
      language: parsed.data.language,
      aspectRatio: parsed.data.aspectRatio,
      selectedAssetIds: [],
    },
    select: {
      id: true,
      name: true,
      status: true,
      createdAt: true,
    },
  });

  return ok(
    {
      id: created.id,
      title: created.name,
      status: created.status,
      createdAt: created.createdAt.toISOString(),
    },
    { status: 201 },
  );
}, 'Failed to create project');
