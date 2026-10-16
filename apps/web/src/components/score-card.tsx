import type { Prediction } from '@/lib/types';
import { ScoreRing } from './score-ring';

/** F-DIAG-03: always a range; honest about early estimates. */
export function ScoreCard({
  prediction,
  target,
  gap,
  compact,
}: {
  prediction: Prediction;
  target?: number | null;
  gap?: number | null;
  compact?: boolean;
}) {
  return (
    <div className="glass relative overflow-hidden rounded-3xl border border-line p-5 sm:p-6">
      <div
        aria-hidden="true"
        className="absolute -top-20 -right-20 size-56 rounded-full bg-emerald-500/15 blur-3xl"
      />
      <div className="relative flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-8">
        <ScoreRing
          low={prediction.low}
          mid={prediction.mid}
          high={prediction.high}
          target={target}
          size={188}
        />
        <dl className="grid w-full grid-cols-2 gap-2 sm:grid-cols-1">
          <div className="rounded-2xl bg-white/[0.04] p-3.5">
            <dt className="text-xs text-muted">Target</dt>
            <dd className="text-2xl font-semibold tabular-nums">{target ?? '—'}</dd>
          </div>
          <div className="rounded-2xl bg-white/[0.04] p-3.5">
            <dt className="text-xs text-muted">Gap</dt>
            <dd
              className={`text-2xl font-semibold tabular-nums ${gap ? 'text-amber-300' : 'text-emerald-300'}`}
            >
              {target ? (gap ? `+${gap}` : 'On track') : '—'}
            </dd>
          </div>
          {!compact && (
            <p className="col-span-2 text-xs text-pretty text-muted sm:col-span-1">
              {prediction.status === 'early'
                ? 'Early estimate — narrows as you practise.'
                : 'Estimate from your answers. Not a guarantee.'}
              {prediction.speedFactor < 1 && ' Slower than exam pace lowers it.'}
            </p>
          )}
        </dl>
      </div>
    </div>
  );
}
