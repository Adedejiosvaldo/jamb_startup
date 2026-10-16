import Link from 'next/link';
import { LogoMark } from './logo';

export function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-10 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <LogoMark className="size-5" />
          <span>Not affiliated with JAMB.</span>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-2">
          {[
            ['/checker', 'Subject checker'],
            ['/help', 'Help'],
            ['/teachers', 'Teachers'],
            ['/privacy', 'Privacy'],
            ['/terms', 'Terms'],
          ].map(([href, label]) => (
            <Link key={href} href={href!} className="hover:text-fg">
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
