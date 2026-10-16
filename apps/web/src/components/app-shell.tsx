'use client';

import { BarChart3, BookOpen, CalendarCheck, UserRound } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { useRequireAuth } from '@/lib/session';
import { Logo } from './logo';
import { PageSkeleton } from './ui/skeleton';

const NAV = [
  { href: '/home', label: 'Today', Icon: CalendarCheck },
  { href: '/practice', label: 'Practice', Icon: BookOpen },
  { href: '/progress', label: 'Progress', Icon: BarChart3 },
  { href: '/account', label: 'Account', Icon: UserRound },
];

/** Student app frame: top bar, content, bottom tab bar (respects the safe area). */
export function AppShell({ children }: { children: ReactNode }) {
  const session = useRequireAuth();
  const pathname = usePathname();
  const ready = !session.loading && session.signedIn && session.me;
  const focused = pathname === '/onboarding';

  return (
    <div className="min-h-dvh bg-slate-50 pb-[calc(4.5rem+env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4">
          <Logo href="/home" />
          {!focused && session.me && !session.me.plan.paid && (
            <Link
              href="/upgrade"
              className="min-h-11 content-center text-sm font-semibold text-teal-700 underline-offset-4 hover:underline"
            >
              Get Season Pass
            </Link>
          )}
        </div>
      </header>
      <main id="main" className="mx-auto max-w-2xl px-4 py-6">
        {ready ? children : <PageSkeleton />}
      </main>
      {!focused && (
        <nav
          aria-label="Main"
          className="fixed inset-x-0 bottom-0 z-10 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)]"
        >
          <ul className="mx-auto grid max-w-2xl grid-cols-4">
            {NAV.map(({ href, label, Icon }) => {
              const active = pathname === href || pathname.startsWith(`${href}/`);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-medium',
                      active ? 'text-teal-700' : 'text-slate-600',
                    )}
                  >
                    <Icon aria-hidden="true" className="size-5" />
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
