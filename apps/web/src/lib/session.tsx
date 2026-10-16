'use client';

import { usePathname, useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, getTokens, onTokensChange, setTokens } from './api';
import type { Me } from './types';

interface SessionValue {
  me: Me | null;
  loading: boolean;
  signedIn: boolean;
  reload: () => Promise<Me | null>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(false);

  const reload = useCallback(async () => {
    if (!getTokens()) {
      setMe(null);
      setSignedIn(false);
      setLoading(false);
      return null;
    }
    try {
      const data = await api<Me>('/v1/me');
      setMe(data);
      setSignedIn(true);
      return data;
    } catch {
      setSignedIn(!!getTokens());
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
    return onTokensChange(() => {
      if (!getTokens()) {
        setMe(null);
        setSignedIn(false);
      }
    });
  }, [reload]);

  const signOut = useCallback(async () => {
    await api('/v1/auth/logout', { method: 'POST' }).catch(() => undefined);
    setTokens(null);
    setMe(null);
    setSignedIn(false);
  }, []);

  return (
    <SessionContext.Provider value={{ me, loading, signedIn, reload, signOut }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionValue {
  const v = useContext(SessionContext);
  if (!v) throw new Error('useSession outside SessionProvider');
  return v;
}

/** Redirects to sign-in when there is no session; sends unfinished students to onboarding. */
export function useRequireAuth({ onboarding = true } = {}) {
  const session = useSession();
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (session.loading) return;
    if (!session.signedIn) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    const m = session.me;
    if (
      onboarding &&
      m &&
      m.role === 'student' &&
      !m.profile?.onboardingDone &&
      pathname !== '/onboarding'
    ) {
      router.replace('/onboarding');
    }
  }, [session.loading, session.signedIn, session.me, onboarding, pathname, router]);
  return session;
}
