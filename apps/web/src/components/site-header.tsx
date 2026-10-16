import Link from 'next/link';
import { Logo } from './logo';

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-line bg-canvas/70 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-2 px-4">
        <Logo />
        <nav aria-label="Site" className="flex items-center gap-1 text-sm font-medium">
          <Link
            href="/checker"
            className="hidden min-h-10 content-center rounded-lg px-3 whitespace-nowrap text-muted hover:text-fg sm:block"
          >
            Subject checker
          </Link>
          <Link
            href="/teachers"
            className="hidden min-h-10 content-center rounded-lg px-3 whitespace-nowrap text-muted hover:text-fg md:block"
          >
            Teachers
          </Link>
          <Link
            href="/login"
            className="min-h-10 content-center rounded-xl border border-line-strong bg-white/[0.04] px-4 whitespace-nowrap text-fg hover:bg-white/[0.08]"
          >
            Sign in
          </Link>
        </nav>
      </div>
    </header>
  );
}
