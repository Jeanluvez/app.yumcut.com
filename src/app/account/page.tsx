import { redirect } from 'next/navigation';
import { AccountSettingsShell } from '@/components/account/AccountSettingsShell';
import { formatDateTime } from '@/lib/date';
import { getAuthSession } from '@/server/auth';
import { prisma } from '@/server/db';

export default async function AccountPage() {
  const session = await getAuthSession();
  if (!session?.user.id) {
    redirect('/');
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      plan: true,
      generationCountThisMonth: true,
      generationResetAt: true,
      storageUsedBytes: true,
      createdAt: true,
    },
  });

  if (!user) {
    redirect('/');
  }

  const createdLabel = formatDateTime(user.createdAt);
  const resetLabel = formatDateTime(user.generationResetAt);
  const storageUsedMb = Number(user.storageUsedBytes) / (1024 * 1024);

  return (
    <AccountSettingsShell
      name={session.user.name?.trim() || '—'}
      email={user.email || '—'}
      userId={user.id}
      createdLabel={createdLabel}
      plan={user.plan}
      generationCountLabel={user.generationCountThisMonth.toLocaleString()}
      resetLabel={resetLabel}
      storageUsedLabel={`${storageUsedMb.toFixed(2)} MB`}
    />
  );
}
