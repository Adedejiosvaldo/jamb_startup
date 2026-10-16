'use client';

import { useApi } from '@/lib/use-api';
import { naira } from '@/lib/format';

/** Live price from the API so the landing page never shows a stale number. */
export function SeasonPrice({ fallback = 'See price after the free test' }: { fallback?: string }) {
  const { data } = useApi<{ code: string; priceKobo: number }[]>('/v1/products', { auth: false });
  const p = data?.find((x) => x.code === 'SEASON_PASS');
  return <span className="tabular-nums">{p ? naira(p.priceKobo) : fallback}</span>;
}
