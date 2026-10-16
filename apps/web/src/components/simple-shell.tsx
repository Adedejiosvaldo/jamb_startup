'use client';

import type { ReactNode } from 'react';
import { useSession } from '@/lib/session';
import { Logo } from './logo';
import { Button } from './ui/button';

export function SimpleShell({
  children,
  width = 'max-w-3xl',
  home = '/',
}: {
  children: ReactNode;
  width?: string;
  home?: string;
}) {
  const { signedIn, signOut } = useSession();
  return (
    <div className="min-h-dvh bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className={`mx-auto flex ${width} items-center justify-between px-4`}>
          <Logo href={home} />
          {signedIn && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void signOut().then(() => (window.location.href = '/'))}
            >
              Sign out
            </Button>
          )}
        </div>
      </header>
      <main id="main" className={`mx-auto ${width} px-4 py-6`}>
        {children}
      </main>
    </div>
  );
}
