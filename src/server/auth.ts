import { auth, currentUser } from '@clerk/nextjs/server';
import { prisma } from './db';

export type AppSession = {
  user: {
    id: string;
    email: string | null;
    name: string | null;
    image: string | null;
    isAdmin: boolean;
  };
} | null;

function getDisplayName(user: Awaited<ReturnType<typeof currentUser>>): string | null {
  if (!user) return null;
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  if (fullName) return fullName;
  if (user.username) return user.username;
  return user.primaryEmailAddress?.emailAddress ?? user.emailAddresses[0]?.emailAddress ?? null;
}

function getPrimaryEmail(user: Awaited<ReturnType<typeof currentUser>>, userId: string): string {
  const email = user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses[0]?.emailAddress ?? null;
  if (email && email.trim()) {
    return email.trim().toLowerCase();
  }
  return `clerk-${userId}@users.invalid`;
}

export async function ensureCurrentUserRecord() {
  const { userId } = await auth();
  if (!userId) {
    return null;
  }

  const user = await currentUser();
  const email = getPrimaryEmail(user, userId);

  return prisma.user.upsert({
    where: { id: userId },
    update: {
      email,
    },
    create: {
      id: userId,
      email,
    },
  });
}

export async function getAuthSession(): Promise<AppSession> {
  const { userId } = await auth();
  if (!userId) {
    return null;
  }

  const user = await currentUser();
  await ensureCurrentUserRecord();

  return {
    user: {
      id: userId,
      email: getPrimaryEmail(user, userId),
      name: getDisplayName(user),
      image: user?.imageUrl ?? null,
      isAdmin: false,
    },
  };
}

export function assertServiceAuth(req: Request) {
  const header = req.headers.get('x-service-password');
  if (!header || header !== process.env.SERVICE_API_PASSWORD) {
    return false;
  }
  return true;
}

export async function assertDaemonAuth(req: Request): Promise<string | null> {
  const passwordHeader = req.headers.get('x-daemon-password');
  if (!passwordHeader || passwordHeader !== process.env.DAEMON_API_PASSWORD) {
    return null;
  }

  const daemonIdHeader = req.headers.get('x-daemon-id');
  const daemonId = daemonIdHeader?.trim() ?? '';
  return daemonId || null;
}
