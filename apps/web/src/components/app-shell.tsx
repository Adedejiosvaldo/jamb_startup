'use client';

import { BarChart3, BookOpen, Home, Sparkles, UserRound } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { useRequireAuth } from '@/lib/session';
import { Logo } from './logo';
import { PageSkeleton } from './ui/skeleton';

const NAV = [
  { href: '/home', label: 'Today', Icon: Home },
  { href: '/practice', label: 'Practice', Icon: BookOpen },
  { href: '/progress', label: 'Progress', Icon: BarChart3 },
  { href: '/account', label: 'Me', Icon: UserRound },
];

/** Student app frame: glass top bar, content, floating tab bar (respects the safe area). */
export function AppShell({ children }: { children: ReactNode }) {
  const session = useRequireAuth();
  const pathname = usePathname();
  const ready = !session.loading && session.signedIn && session.me;
  const focused = pathname === '/onboarding';

  return (
    <div className="relative min-h-dvh pb-[calc(6rem+env(safe-area-inset-bottom))]">
      <div
        aria-hidden="true"
        className="bg-glow pointer-events-none absolute inset-x-0 top-0 h-80 opacity-70"
      />
      <header className="sticky top-0 z-10 border-b border-line bg-canvas/70 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
          <Logo href="/home" />
          {!focused && session.me && !session.me.plan.paid && (
            <Link
              href="/upgrade"
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-emerald-400/30 bg-accent-soft px-3 text-sm font-medium text-emerald-300 hover:bg-emerald-400/20"
            >
              <Sparkles aria-hidden="true" className="size-3.5" /> Upgrade
            </Link>
          )}
        </div>
      </header>
      <main id="main" className="relative mx-auto max-w-2xl px-4 py-6">
        {ready ? children : <PageSkeleton />}
      </main>
      {!focused && (
        <nav
          aria-label="Main"
          className="fixed inset-x-0 bottom-0 z-10 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]"
        >
          <ul className="mx-auto grid max-w-md grid-cols-4 rounded-2xl border border-line-strong bg-surface-2/85 p-1.5 shadow-2xl shadow-black/50 backdrop-blur-md">
            {NAV.map(({ href, label, Icon }) => {
              const active = pathname === href || pathname.startsWith(`${href}/`);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-medium transition-colors duration-150',
                      active ? 'bg-white/[0.08] text-fg' : 'text-muted hover:text-fg',
                    )}
                  >
                    <Icon aria-hidden="true" className={cn('size-5', active && 'text-accent')} />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </div>
  );
}
