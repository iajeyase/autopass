import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentActor } from '@/auth/actor';
import { RegisterForm } from '@/components/auth-forms';
import { Card } from '@/components/ui';

export const metadata = { title: 'Registrieren' };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ type?: string; next?: string }> }) {
  if (await getCurrentActor()) {
    redirect('/dashboard');
  }
  const { type, next } = await searchParams;
  const initialType = type === 'DEALER' ? 'DEALER' : 'CUSTOMER';
  return (
    <div className="mx-auto max-w-xl px-4 py-12 sm:px-6">
      <Card title="Konto erstellen" description="Privatperson oder Autohändler. Firmenkunden registrieren sich als Privatperson und werden anschliessend freigeschaltet.">
        <RegisterForm initialType={initialType} next={next?.startsWith('/') && !next.startsWith('//') ? next : undefined} />
      </Card>
      <p className="mt-6 text-center text-sm text-muted">
        Bereits registriert?{' '}
        <Link href="/anmelden" className="font-medium text-accent">
          Anmelden
        </Link>
      </p>
    </div>
  );
}
