import Link from 'next/link';
import { Logo } from './logo';

const link = 'min-h-11 content-center rounded-lg px-2 whitespace-nowrap sm:px-3';

export function SiteHeader() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-2 px-4">
        <Logo />
        <nav aria-label="Site" className="flex items-center gap-1 text-sm font-medium">
          <Link href="/checker" className={`${link} text-slate-700 hover:bg-slate-100`}>
            <span className="sm:hidden">Checker</span>
            <span className="hidden sm:inline">Subject checker</span>
          </Link>
          <Link href="/login" className={`${link} text-teal-700 hover:bg-teal-50`}>
            Sign in
          </Link>
        </nav>
      </div>
    </header>
  );
}
