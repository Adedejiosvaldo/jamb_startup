import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import type { MasteryLabel } from '@/lib/types';

type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger';
const tones: Record<Tone, string> = {
  neutral: 'bg-white/[0.06] text-fg-2 ring-white/10',
  accent: 'bg-accent-soft text-emerald-300 ring-emerald-400/20',
  success: 'bg-emerald-500/10 text-emerald-300 ring-emerald-400/20',
  warning: 'bg-amber-500/10 text-amber-300 ring-amber-400/20',
  danger: 'bg-red-500/10 text-red-300 ring-red-400/20',
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
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset',
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
