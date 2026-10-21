import { PublicShell } from '@/components/public-shell';
import { env } from '@/lib/env';

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <PublicShell demo={env().DEMO_MODE}>{children}</PublicShell>;
}
