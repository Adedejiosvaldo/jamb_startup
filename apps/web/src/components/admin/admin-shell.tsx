'use client';

import { Menu } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { Logo } from '@/components/logo';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { PageSkeleton } from '@/components/ui/skeleton';
import { api, ApiError, errorMessage, setTokens, type Tokens } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useRequireAuth } from '@/lib/session';

const NAV: { href: string; label: string; adminOnly?: boolean }[] = [
  { href: '/admin', label: 'Dashboard', adminOnly: true },
  { href: '/admin/questions', label: 'Questions' },
  { href: '/admin/reports', label: 'Question reports' },
  { href: '/admin/users', label: 'Users', adminOnly: true },
  { href: '/admin/orders', label: 'Orders', adminOnly: true },
  { href: '/admin/tickets', label: 'Support', adminOnly: true },
  { href: '/admin/parent-reports', label: 'Parent reports', adminOnly: true },
  { href: '/admin/outbox', label: 'WhatsApp outbox', adminOnly: true },
  { href: '/admin/schools', label: 'Schools', adminOnly: true },
  { href: '/admin/teachers', label: 'Teachers', adminOnly: true },
  { href: '/admin/coupons', label: 'Coupons', adminOnly: true },
  { href: '/admin/catalogue', label: 'Courses & topics', adminOnly: true },
  { href: '/admin/settings', label: 'Exam config & news', adminOnly: true },
];

type Gate = 'checking' | 'ok' | 'mfa' | 'forbidden';

/** Staff area: admin/reviewer role + TOTP 2FA (spec §14). */
export function AdminShell({ children }: { children: ReactNode }) {
  const session = useRequireAuth({ onboarding: false });
  const pathname = usePathname();
  const [gate, setGate] = useState<Gate>('checking');
  const [menuOpen, setMenuOpen] = useState(false);
  const role = session.me?.role;

  useEffect(() => {
    if (!session.me) return;
    if (role !== 'admin' && role !== 'reviewer') {
      setGate('forbidden');
      return;
    }
    api('/v1/admin/questions?pageSize=1')
      .then(() => setGate('ok'))
      .catch((e) =>
        setGate(e instanceof ApiError && e.code === 'MFA_REQUIRED' ? 'mfa' : 'forbidden'),
      );
  }, [session.me, role]);

  if (session.loading || gate === 'checking') {
    return (
      <div className="mx-auto max-w-md px-4 py-12">
        <PageSkeleton />
      </div>
    );
  }
  if (gate === 'forbidden') {
    return (
      <main id="main" className="mx-auto max-w-md px-4 py-12">
        <Alert tone="danger" title="Staff only">
          Your account doesn’t have access to this area.
        </Alert>
      </main>
    );
  }
  if (gate === 'mfa')
    return <MfaGate enabled={!!session.me?.mfaEnabled} onDone={() => setGate('ok')} />;

  const nav = NAV.filter((n) => role === 'admin' || !n.adminOnly);
  const links = (
    <ul className="space-y-0.5">
      {nav.map((n) => {
        const active = n.href === '/admin' ? pathname === '/admin' : pathname.startsWith(n.href);
        return (
          <li key={n.href}>
            <Link
              href={n.href}
              onClick={() => setMenuOpen(false)}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex min-h-10 items-center rounded-lg px-3 text-sm font-medium',
                active ? 'bg-accent-soft text-accent' : 'text-fg-2 hover:bg-surface-2',
              )}
            >
              {n.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className="min-h-dvh bg-canvas print:bg-white">
      <header className="sticky top-0 z-10 border-b border-line bg-surface print:hidden">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4">
          <div className="flex items-center gap-2">
            <Logo href="/admin" />
            <span className="rounded-full border border-line-strong bg-white/[0.06] px-2 py-0.5 text-xs font-medium text-fg-2">
              Staff
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden text-sm text-muted sm:inline">
              {session.me?.name ?? session.me?.phone}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void session.signOut().then(() => (window.location.href = '/'))}
            >
              Sign out
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="lg:hidden"
              aria-expanded={menuOpen}
              aria-controls="admin-nav"
              onClick={() => setMenuOpen((o) => !o)}
            >
              <Menu aria-hidden="true" className="size-4" /> Menu
            </Button>
          </div>
        </div>
        {menuOpen && (
          <nav id="admin-nav" aria-label="Admin" className="border-t border-line p-2 lg:hidden">
            {links}
          </nav>
        )}
      </header>
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[13rem_1fr] print:block print:p-0">
        <nav aria-label="Admin" className="hidden lg:block print:hidden">
          <div className="sticky top-20">{links}</div>
        </nav>
        <main id="main" className="min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}

function MfaGate({ enabled, onDone }: { enabled: boolean; onDone: () => void }) {
  const [setup, setSetup] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main id="main" className="mx-auto max-w-md space-y-5 px-4 py-12">
      <Logo />
      <h1 className="text-2xl font-bold text-balance">Two-step verification</h1>
      {!enabled && !setup ? (
        <>
          <p className="text-pretty text-fg-2">
            Staff accounts must use an authenticator app (Google Authenticator, Authy or Microsoft
            Authenticator). Set it up once on this account.
          </p>
          <Button
            block
            loading={busy}
            onClick={() =>
              void run(async () => setSetup(await api('/v1/auth/mfa/setup', { method: 'POST' })))
            }
          >
            Set up authenticator
          </Button>
        </>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              const tokens = await api<Tokens>('/v1/auth/mfa/verify', {
                method: 'POST',
                body: { code },
              });
              setTokens(tokens);
              onDone();
            });
          }}
        >
          {setup && (
            <div className="space-y-2 rounded-lg border border-line bg-surface p-3 text-sm">
              <p>In your authenticator app, add an account with this key:</p>
              <p className="font-mono text-base break-all select-all">
                {setup.secret.replace(/(.{4})/g, '$1 ').trim()}
              </p>
              <a href={setup.otpauthUrl} className="font-semibold text-accent underline">
                Or open in authenticator app (on this phone)
              </a>
            </div>
          )}
          <Field
            label="6-digit code from your app"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            error={error}
          />
          <Button type="submit" block loading={busy} disabled={code.length !== 6}>
            Verify
          </Button>
        </form>
      )}
      {error && !(enabled || setup) && <Alert tone="danger">{error}</Alert>}
    </main>
  );
}
