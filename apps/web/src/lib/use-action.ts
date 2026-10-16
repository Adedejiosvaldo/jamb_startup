'use client';

import { useState } from 'react';
import { errorMessage } from './api';

/** Wraps a mutation with busy + error state; `key` lets several buttons share one hook. */
export function useAction() {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function run<T>(
    key: string,
    fn: () => Promise<T>,
    success?: string,
  ): Promise<T | undefined> {
    setBusy(key);
    setError(null);
    setNotice(null);
    try {
      const r = await fn();
      if (success) setNotice(success);
      return r;
    } catch (e) {
      setError(errorMessage(e));
      return undefined;
    } finally {
      setBusy(null);
    }
  }
  return { run, busy, error, notice, setError, setNotice };
}
