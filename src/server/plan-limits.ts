import type { Plan } from '@prisma/client';
import { prisma } from '@/server/db';

const MONTHLY_VIDEO_GENERATION_LIMITS: Record<Plan, number> = {
  free: 3,
  pro: 30,
  business: 100,
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
