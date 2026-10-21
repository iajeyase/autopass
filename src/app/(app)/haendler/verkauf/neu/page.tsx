import { redirect } from 'next/navigation';
import { requireActor, isOperator } from '@/auth/actor';
import { SaleForm } from '@/components/sale-form';
import { Card, PageHeader } from '@/components/ui';

export const metadata = { title: 'Neuer Verkauf' };

export default async function NewSalePage() {
  const actor = await requireActor();
  if (isOperator(actor) || !actor.memberships.some((m) => m.organizationType === 'DEALER')) {
    redirect('/dashboard');
  }
  return (
    <>
      <PageHeader title="Neuer Fahrzeugverkauf" subtitle="Erfassen Sie den Verkauf einmal. Der Käufer muss die Angaben danach nicht erneut eingeben." />
      <Card className="max-w-3xl">
        <SaleForm />
      </Card>
    </>
  );
}
