import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentActor } from '@/auth/actor';
import { LoginForm } from '@/components/auth-forms';
import { Card } from '@/components/ui';

export const metadata = { title: 'Anmelden' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  if (await getCurrentActor()) {
    redirect('/dashboard');
  }
  return (
    <div className="mx-auto flex min-h-[70dvh] max-w-md flex-col justify-center px-4 py-12 sm:px-6">
      <Card title="Anmelden" description="Willkommen zurück bei AutoPass.">
        <LoginForm next={next?.startsWith('/') && !next.startsWith('//') ? next : undefined} />
      </Card>
      <p className="mt-6 text-center text-sm text-muted">
        Noch kein Konto?{' '}
        <Link href="/registrieren" className="font-medium text-accent">
          Registrieren
        </Link>
      </p>
    </div>
  );
}
