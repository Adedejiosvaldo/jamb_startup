'use client';

import { useEffect } from 'react';
import { track } from '@/lib/api';

export function Track({ name, props }: { name: string; props?: Record<string, unknown> }) {
  useEffect(() => {
    track(name, props);
  }, [name]);
  return null;
}
