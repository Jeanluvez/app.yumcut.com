import { CreateConfirmationShell } from '@/components/create/CreateConfirmationShell';

export default async function ConfirmCreatePage({ params }: { params: Promise<{ draftId: string }> }) {
  const { draftId } = await params;
  return <CreateConfirmationShell draftId={draftId} />;
}
