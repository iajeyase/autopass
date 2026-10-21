import { PublicShell } from '@/components/public-shell';
import { env } from '@/lib/env';

// Zur Laufzeit rendern: Die Konfiguration muss nicht schon beim Build vollständig sein.
export const dynamic = 'force-dynamic';

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <PublicShell demo={env().DEMO_MODE}>{children}</PublicShell>;
}
