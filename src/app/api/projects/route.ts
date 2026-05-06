import { NextRequest } from 'next/server';
import { withApiError } from '@/server/errors';
import { authenticateApiRequest } from '@/server/api-user';
import { prisma } from '@/server/db';
import { error, ok, unauthorized } from '@/server/http';
import { createSproklProjectSchema } from '@/server/validators/projects';
import { deriveProjectDisplayStatus } from '@/shared/project-status';

export const GET = withApiError(async function GET(req: NextRequest) {
  const auth = await authenticateApiRequest(req);
  if (!auth) return unauthorized();

  const projects = await prisma.project.findMany({
    where: {
      userId: auth.userId,
      OR: [
        { videoJobs: { some: {} } },
        { videos: { some: {} } },
        { status: { in: ['generating', 'done', 'failed'] } },
      ],
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      status: true,
      durationSeconds: true,
      language: true,
      aspectRatio: true,
      promoInfo: true,
      createdAt: true,
      videos: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: {
          id: true,
          storageUrl: true,
          thumbnailUrl: true,
          fileSizeBytes: true,
        },
      },
      videoJobs: {
        select: {
          status: true,
        },
      },
    },
  });

  return ok(
    projects.map((project) => ({
      id: project.id,
      title: project.name,
      status: deriveProjectDisplayStatus({
        projectStatus: project.status,
        videoJobs: project.videoJobs,
      }),
      durationSeconds: project.durationSeconds,
      language: project.language,
      aspectRatio: project.aspectRatio,
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
                channelId?: string | null;
                title?: string;
                description?: string;
              publishAt?: string;
              status?: 'draft' | 'scheduled' | 'ready' | 'published' | 'failed';
              publishedAt?: string | null;
              providerPostId?: string | null;
              publishedUrl?: string | null;
              lastAttemptAt?: string | null;
              errorMessage?: string | null;
              createdAt?: string;
              updatedAt?: string;
            }>;
            }).publishQueue?.map((item) => ({
              id: item.id ?? '',
              videoId: item.videoId ?? '',
              platform: item.platform ?? 'tiktok',
              channelId: item.channelId ?? null,
              title: item.title ?? '',
              description: item.description ?? '',
              publishAt: item.publishAt ?? '',
              status:
                item.status === 'ready'
                  ? 'ready'
                  : item.status === 'published'
                  ? 'published'
                  : item.status === 'failed'
                    ? 'failed'
                    : item.status === 'scheduled'
                      ? (item.publishAt && Date.parse(item.publishAt) <= Date.now() ? 'ready' : 'scheduled')
                      : 'draft',
              publishedAt: item.publishedAt ?? null,
              providerPostId: item.providerPostId ?? null,
              publishedUrl: item.publishedUrl ?? null,
              lastAttemptAt: item.lastAttemptAt ?? null,
              errorMessage: item.errorMessage ?? null,
              createdAt: item.createdAt ?? item.publishAt ?? '',
              updatedAt: item.updatedAt ?? item.publishAt ?? '',
            })) ?? []
          : [],
      latestVideo: project.videos[0]
        ? {
            id: project.videos[0].id,
            storageUrl: project.videos[0].storageUrl,
            thumbnailUrl: project.videos[0].thumbnailUrl,
            fileSizeBytes: project.videos[0].fileSizeBytes.toString(),
          }
        : null,
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
      durationSeconds: true,
      language: true,
      aspectRatio: true,
      createdAt: true,
    },
  });

  return ok(
    {
      id: created.id,
      title: created.name,
      status: created.status,
      durationSeconds: created.durationSeconds,
      language: created.language,
      aspectRatio: created.aspectRatio,
      latestVideo: null,
      createdAt: created.createdAt.toISOString(),
    },
    { status: 201 },
  );
}, 'Failed to create project');
