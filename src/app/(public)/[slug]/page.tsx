import { notFound } from 'next/navigation';
import { Alert } from '@/components/ui';
import { PUBLIC_PAGES } from '@/content/public-pages';

export function generateStaticParams() {
  return Object.keys(PUBLIC_PAGES).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = PUBLIC_PAGES[slug];
  return { title: page?.title ?? 'Seite' };
}

export default async function ContentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = PUBLIC_PAGES[slug];
  if (!page) {
    notFound();
  }
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{page.title}</h1>
      <p className="mt-4 text-base text-muted sm:text-lg">{page.lead}</p>
      {page.draftNotice && (
        <Alert tone="warning" className="mt-6">
          {page.draftNotice}
        </Alert>
      )}
      <div className="mt-10 space-y-10">
        {page.sections.map((section) => (
          <section key={section.heading}>
            <h2 className="text-xl font-semibold tracking-tight">{section.heading}</h2>
            <div className="mt-3 space-y-3 text-[15px] leading-7">
              {section.paragraphs.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>
          </section>
        ))}
      </div>
    </article>
  );
}
