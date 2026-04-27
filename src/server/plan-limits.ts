import type { Plan } from '@prisma/client';
import { prisma } from '@/server/db';

const MONTHLY_VIDEO_GENERATION_LIMITS: Record<Plan, number> = {
  free: 3,
  pro: 30,
  business: 100,
};

const STORAGE_LIMIT_BYTES: Record<Plan, bigint> = {
  free: BigInt(500 * 1024 * 1024),
  pro: BigInt(10 * 1024 * 1024 * 1024),
  business: BigInt(50 * 1024 * 1024 * 1024),
};

function startOfNextMonth(from: Date) {
  return new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 1, 0, 0, 0, 0));
}

export async function syncUserGenerationUsageWindow(userId: string) {
  const now = new Date();
  const current = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      plan: true,
      generationCountThisMonth: true,
      generationResetAt: true,
    },
  });

  if (!current) {
    throw new Error('User not found');
  }

  if (current.generationResetAt > now) {
    return current;
  }

  return prisma.user.update({
    where: { id: userId },
    data: {
      generationCountThisMonth: 0,
      generationResetAt: startOfNextMonth(now),
    },
    select: {
      id: true,
      plan: true,
      generationCountThisMonth: true,
      generationResetAt: true,
    },
  });
}

export async function getVideoGenerationAllowance(userId: string) {
  const user = await syncUserGenerationUsageWindow(userId);
  const monthlyLimit = MONTHLY_VIDEO_GENERATION_LIMITS[user.plan];
  const used = user.generationCountThisMonth;
  const remaining = Math.max(0, monthlyLimit - used);

  return {
    plan: user.plan,
    used,
    monthlyLimit,
    remaining,
    resetsAt: user.generationResetAt,
  };
}

export async function incrementVideoGenerationCount(userId: string, amount = 1) {
  const user = await syncUserGenerationUsageWindow(userId);
  return prisma.user.update({
    where: { id: userId },
    data: {
      generationCountThisMonth: user.generationCountThisMonth + amount,
    },
    select: {
      id: true,
      plan: true,
      generationCountThisMonth: true,
      generationResetAt: true,
    },
  });
}

export function getStorageLimitBytes(plan: Plan) {
  return STORAGE_LIMIT_BYTES[plan];
}

export function formatBytesForHumans(value: bigint) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export async function getStorageAllowance(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      plan: true,
      storageUsedBytes: true,
    },
  });

  if (!user) {
    throw new Error('User not found');
  }

  const storageLimitBytes = getStorageLimitBytes(user.plan);
  const usedBytes = user.storageUsedBytes;
  const remainingBytes = storageLimitBytes > usedBytes ? storageLimitBytes - usedBytes : BigInt(0);

  return {
    plan: user.plan,
    usedBytes,
    storageLimitBytes,
    remainingBytes,
  };
}
