import { notFound } from 'next/navigation';
import { requireActor } from '@/auth/actor';
import { CaseDetail } from '@/components/case/case-detail';
import { getCaseView } from '@/services/query-service';
import { DomainError } from '@/lib/errors';

export const metadata = { title: 'Vorgang' };

export default async function CasePage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireActor();
  const { id } = await params;
  const view = await getCaseView(actor, id).catch((error: unknown) => {
    if (error instanceof DomainError && error.code === 'NOT_FOUND') {
      notFound();
    }
    throw error;
  });
  return <CaseDetail view={view} />;
}
