import { redirect } from 'next/navigation';
import { WorkspaceShell } from '@/components/workspace/WorkspaceShell';
import { getAuthSession } from '@/server/auth';

export default async function WorkspaceAssetsPage() {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    redirect('/sign-in');
  }

  return <WorkspaceShell section="assets" />;
}
