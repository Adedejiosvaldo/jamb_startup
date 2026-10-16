import { Flag } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface NavItem {
  position: number;
  answered: boolean;
  flagged: boolean;
  correct?: boolean | null;
}

/** Numbered grid. State uses fill + icon, not colour alone (DESIGN.md: CBT screen). */
export function Navigator({
  items,
  current,
  onJump,
  numberFrom = 1,
}: {
  items: NavItem[];
  current: number;
  onJump: (index: number) => void;
  numberFrom?: number;
}) {
  return (
    <ol className="grid grid-cols-6 gap-1.5 sm:grid-cols-8 lg:grid-cols-5">
      {items.map((it, i) => {
        const n = i + numberFrom;
        const state = [
          it.answered ? 'answered' : 'not answered',
          it.flagged ? 'flagged' : null,
          it.correct === true ? 'correct' : it.correct === false ? 'wrong' : null,
        ]
          .filter(Boolean)
          .join(', ');
        return (
          <li key={it.position}>
            <button
              type="button"
              onClick={() => onJump(i)}
              aria-label={`Question ${n}, ${state}`}
              aria-current={i === current ? 'step' : undefined}
              className={cn(
                'relative grid min-h-10 w-full place-items-center rounded-md border text-sm font-semibold tabular-nums focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent',
                it.correct === false
                  ? 'border-red-400 bg-red-500/10 text-red-300'
                  : it.answered
                    ? 'border-accent bg-accent text-on-accent'
                    : 'border-line-strong bg-surface text-fg-2',
                i === current && 'ring-2 ring-fg ring-offset-1',
              )}
            >
              {n}
              {it.flagged && (
                <Flag
                  aria-hidden="true"
                  className="absolute -top-1 -right-1 size-3.5 fill-amber-400 text-amber-400"
                />
              )}
            </button>
          </li>
        );
      })}
    </ol>
  );
}

export function NavigatorLegend() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
      <li className="flex items-center gap-1.5">
        <span aria-hidden="true" className="size-3 rounded-sm bg-accent" /> Answered
      </li>
      <li className="flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className="size-3 rounded-sm border border-line-strong bg-surface"
        />{' '}
        Not answered
      </li>
      <li className="flex items-center gap-1.5">
        <Flag aria-hidden="true" className="size-3 fill-amber-400 text-amber-400" /> Flagged
      </li>
    </ul>
  );
}
