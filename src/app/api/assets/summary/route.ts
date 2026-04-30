import { NextRequest } from 'next/server';
import { authenticateApiRequest } from '@/server/api-user';
import { withApiError } from '@/server/errors';
import { unauthorized, ok } from '@/server/http';
import { getStorageAllowance } from '@/server/plan-limits';
import { prisma } from '@/server/db';

export const GET = withApiError(async function GET(req: NextRequest) {
  const auth = await authenticateApiRequest(req);
  if (!auth) return unauthorized();

  const [storage, assetCount] = await Promise.all([
    getStorageAllowance(auth.userId),
    prisma.asset.count({
      where: {
        userId: auth.userId,
      },
    }),
  ]);

  return ok({
    plan: storage.plan,
    usedBytes: storage.usedBytes.toString(),
    storageLimitBytes: storage.storageLimitBytes.toString(),
    remainingBytes: storage.remainingBytes.toString(),
    assetCount,
  });
}, 'Failed to load asset summary');
