import { redirect } from 'next/navigation';
import { LanguagePreferenceCard } from '@/components/account/language-preference-card';
import { AccountOverviewCard } from '@/components/account/account-summary-cards';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDateTime } from '@/lib/date';
import { normalizeAppLanguage } from '@/shared/constants/app-language';
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
  const preferredLanguage = normalizeAppLanguage('en');

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <AccountOverviewCard
        name={session.user.name?.trim() || '—'}
        email={user.email || '—'}
        userId={user.id}
        createdLabel={createdLabel}
      />

      <LanguagePreferenceCard initialLanguage={preferredLanguage} />

      <Card>
        <CardHeader>
          <CardTitle>Plan usage</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-center justify-between gap-4">
            <span className="text-gray-500 dark:text-gray-400">Current plan</span>
            <span className="font-medium text-gray-900 dark:text-gray-100 capitalize">{user.plan}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-gray-500 dark:text-gray-400">Monthly generations used</span>
            <span className="font-medium text-gray-900 dark:text-gray-100">
              {user.generationCountThisMonth.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-gray-500 dark:text-gray-400">Generation counter resets</span>
            <span className="font-medium text-gray-900 dark:text-gray-100">{resetLabel}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-gray-500 dark:text-gray-400">Storage used</span>
            <span className="font-medium text-gray-900 dark:text-gray-100">{storageUsedMb.toFixed(2)} MB</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
