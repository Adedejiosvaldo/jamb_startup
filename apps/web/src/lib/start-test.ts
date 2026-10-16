'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api, ApiError, errorMessage, track } from './api';
import type { PlanItem } from './types';

export interface StartBody {
  type:
    | 'diagnostic'
    | 'short_diagnostic'
    | 'mini_mock'
    | 'full_mock'
    | 'practice'
    | 'speed_drill'
    | 'review';
  topicId?: string;
  subjectCode?: string;
  count?: number;
  planItemId?: string;
}

export function planItemToBody(item: PlanItem): StartBody {
  switch (item.kind) {
    case 'practice':
      return { type: 'practice', topicId: item.topicId, count: item.count, planItemId: item.id };
    case 'speed_drill':
      return { type: 'speed_drill', subjectCode: item.subjectCode, planItemId: item.id };
    case 'review':
      return { type: 'review', count: item.count, planItemId: item.id };
    default:
      return { type: item.kind, planItemId: item.id };
  }
}

/** Creates a test and opens the CBT screen; paywalled starts go to /upgrade with the reason. */
export function useStartTest() {
  const router = useRouter();
  const [starting, setStarting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function start(body: StartBody, key: string = body.type) {
    setStarting(key);
    setError(null);
    try {
      const test = await api<{ id: string }>('/v1/tests', { method: 'POST', body });
      if (body.type === 'diagnostic' || body.type === 'short_diagnostic')
        track('diagnostic_started', { type: body.type });
      router.push(`/test/${test.id}`);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'PAYWALL') {
        router.push(`/upgrade?reason=${encodeURIComponent(err.message)}`);
        return;
      }
      setError(errorMessage(err));
      setStarting(null);
    }
  }

  return { start, starting, error, setError };
}
