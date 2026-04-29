import { NextRequest } from 'next/server';
import { z } from 'zod';
import { authenticateApiRequest } from '@/server/api-user';
import { prisma } from '@/server/db';
import { error, notFound, ok, unauthorized } from '@/server/http';
import { withApiError } from '@/server/errors';

type Params = { channelId: string };

const updateChannelSchema = z.object({
  status: z.enum(['connected', 'disconnected']).optional(),
  displayName: z.string().trim().min(1).max(120).optional(),
  handle: z.string().trim().max(120).nullable().optional(),
});

export const PATCH = withApiError(async function PATCH(req: NextRequest, { params }: { params: Promise<Params> }) {
  const auth = await authenticateApiRequest(req);
  if (!auth) return unauthorized();

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return error('INVALID_JSON', 'Request body must be valid JSON', 400);
  }

  const parsed = updateChannelSchema.safeParse(json);
  if (!parsed.success) {
    return error('VALIDATION_ERROR', 'Invalid channel update payload', 400, parsed.error.flatten());
  }

  const { channelId } = await params;
  const channel = await prisma.channelConnection.findFirst({
    where: { id: channelId, userId: auth.userId },
    select: { id: true },
  });
  if (!channel) return notFound('Channel not found');

  const updated = await prisma.channelConnection.update({
    where: { id: channel.id },
    data: {
      ...(parsed.data.status ? { status: parsed.data.status } : {}),
      ...(parsed.data.displayName !== undefined ? { displayName: parsed.data.displayName } : {}),
      ...(parsed.data.handle !== undefined ? { handle: parsed.data.handle?.trim() || null } : {}),
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
    id: updated.id,
    platform: updated.platform,
    displayName: updated.displayName,
    handle: updated.handle,
    status: updated.status,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  });
}, 'Failed to update channel');

export const DELETE = withApiError(async function DELETE(req: NextRequest, { params }: { params: Promise<Params> }) {
  const auth = await authenticateApiRequest(req);
  if (!auth) return unauthorized();

  const { channelId } = await params;
  const channel = await prisma.channelConnection.findFirst({
    where: { id: channelId, userId: auth.userId },
    select: { id: true },
  });
  if (!channel) return notFound('Channel not found');

  await prisma.channelConnection.delete({ where: { id: channel.id } });
  return ok({ ok: true, id: channel.id });
}, 'Failed to delete channel');
