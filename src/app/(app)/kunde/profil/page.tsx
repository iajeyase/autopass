import { requireActor } from '@/auth/actor';
import { ProfileForm } from '@/components/profile-form';
import { Card, PageHeader } from '@/components/ui';
import { db } from '@/lib/db';

export const metadata = { title: 'Profil' };

export default async function ProfilePage() {
  const actor = await requireActor();
  const profile = await db.customerProfile.findUnique({ where: { userId: actor.userId } });
  return (
    <>
      <PageHeader title="Profil" subtitle="Ihre Adresse wird für die Zulassung benötigt. Wir erfassen nur, was der Prozess braucht." />
      <Card className="max-w-2xl">
        <ProfileForm
          defaults={{
            phone: profile?.phone ?? '',
            street: profile?.street ?? '',
            zip: profile?.zip ?? '',
            city: profile?.city ?? '',
            canton: profile?.canton ?? '',
          }}
        />
      </Card>
    </>
  );
}
