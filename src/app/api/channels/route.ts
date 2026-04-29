import { NextRequest } from 'next/server';
import { z } from 'zod';
import { authenticateApiRequest } from '@/server/api-user';
import { prisma } from '@/server/db';
import { error, ok, unauthorized } from '@/server/http';
import { withApiError } from '@/server/errors';

const createChannelSchema = z.object({
  platform: z.enum(['tiktok', 'instagram_reels', 'youtube_shorts']),
  displayName: z.string().trim().min(1).max(120),
  handle: z.string().trim().max(120).optional().or(z.literal('')),
});

export const GET = withApiError(async function GET(req: NextRequest) {
  const auth = await authenticateApiRequest(req);
  if (!auth) return unauthorized();

  const channels = await prisma.channelConnection.findMany({
    where: { userId: auth.userId },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      platform: true,
      displayName: true,
      handle: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return ok(channels.map((channel) => ({
    id: channel.id,
    platform: channel.platform,
    displayName: channel.displayName,
    handle: channel.handle,
    status: channel.status,
    createdAt: channel.createdAt.toISOString(),
    updatedAt: channel.updatedAt.toISOString(),
  })));
}, 'Failed to list channels');

export const POST = withApiError(async function POST(req: NextRequest) {
  const auth = await authenticateApiRequest(req);
  if (!auth) return unauthorized();

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return error('INVALID_JSON', 'Request body must be valid JSON', 400);
  }

  const parsed = createChannelSchema.safeParse(json);
  if (!parsed.success) {
    return error('VALIDATION_ERROR', 'Invalid channel payload', 400, parsed.error.flatten());
  }

  const created = await prisma.channelConnection.create({
    data: {
      userId: auth.userId,
      platform: parsed.data.platform,
      displayName: parsed.data.displayName,
      handle: parsed.data.handle?.trim() || null,
      status: 'connected',
    },
    select: {
      id: true,
      platform: true,
      displayName: true,
      handle: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return ok({
    id: created.id,
    platform: created.platform,
    displayName: created.displayName,
    handle: created.handle,
    status: created.status,
    createdAt: created.createdAt.toISOString(),
    updatedAt: created.updatedAt.toISOString(),
  }, { status: 201 });
}, 'Failed to create channel');
