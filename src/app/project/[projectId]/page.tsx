import { ProjectDetailShell } from '@/components/project/ProjectDetailShell';
import { getAuthSession } from '@/server/auth';
import { redirect } from 'next/navigation';

type Params = { projectId: string };

export default async function ProjectPage({ params }: { params: Promise<Params> }) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    redirect('/sign-in');
  }
  const { projectId } = await params;
  return <ProjectDetailShell projectId={projectId} />;
}
