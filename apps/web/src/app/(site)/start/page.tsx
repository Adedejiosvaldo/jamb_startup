'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';
import { PageSkeleton } from '@/components/ui/skeleton';
import { storage } from '@/lib/api';
import { useSession } from '@/lib/session';

/** Entry from ads, school reports and teacher links: remembers ?coupon= and routes onward. */
function Start() {
  const params = useSearchParams();
  const router = useRouter();
  const { loading, signedIn } = useSession();

  useEffect(() => {
    const coupon = params.get('coupon');
    if (coupon) storage.set('sc.coupon', coupon.toUpperCase());
    const cls = params.get('class');
    if (cls) storage.set('sc.class', cls.toUpperCase());
    if (loading) return;
    router.replace(signedIn ? '/home' : '/login?next=/home');
  }, [params, loading, signedIn, router]);

  return <PageSkeleton />;
}

export default function StartPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Start />
    </Suspense>
  );
}
