import { redirect } from 'next/navigation';
import { LandingPageShell } from '@/components/landing/LandingPageShell';
import { getAuthSession } from '@/server/auth';

export default async function Home() {
  const session = await getAuthSession();
  if (session?.user?.id) {
    redirect('/workspace');
  }

  return <LandingPageShell />;
}
