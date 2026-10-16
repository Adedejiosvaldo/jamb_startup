import { Footer } from '@/components/footer';
import { SiteHeader } from '@/components/site-header';

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto max-w-2xl px-4 py-8">
        {children}
      </main>
      <Footer />
    </>
  );
}
