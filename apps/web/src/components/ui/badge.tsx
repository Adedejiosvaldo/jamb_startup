import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import type { MasteryLabel } from '@/lib/types';

type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger';
const tones: Record<Tone, string> = {
  neutral: 'bg-slate-100 text-slate-700',
  accent: 'bg-teal-50 text-teal-800',
  success: 'bg-green-50 text-green-800',
  warning: 'bg-amber-50 text-amber-900',
  danger: 'bg-red-50 text-red-800',
};

export function Badge({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

const MASTERY: Record<MasteryLabel, { tone: Tone; text: string }> = {
  not_started: { tone: 'neutral', text: 'Not started' },
  weak: { tone: 'danger', text: 'Weak' },
  getting_there: { tone: 'warning', text: 'Getting there' },
  strong: { tone: 'success', text: 'Strong' },
};

/** Colour always paired with words (DESIGN.md). */
export function MasteryBadge({ label }: { label: MasteryLabel }) {
  const m = MASTERY[label];
  return <Badge tone={m.tone}>{m.text}</Badge>;
}
