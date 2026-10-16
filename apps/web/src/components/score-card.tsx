import { Info } from 'lucide-react';
import type { Prediction } from '@/lib/types';
import { Card } from './ui/card';

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
  const pctOf = (v: number) => `${(v / 400) * 100}%`;
  return (
    <Card className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-600">Predicted UTME score</p>
          <p className="mt-1 text-4xl font-bold tabular-nums">
            {prediction.low}–{prediction.high}
          </p>
          <p className="text-sm text-slate-600 tabular-nums">
            Most likely around {prediction.mid} out of 400
          </p>
        </div>
        {prediction.status === 'early' && (
          <span className="rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-900">
            Early estimate
          </span>
        )}
      </div>

      <div aria-hidden="true" className="relative h-3 rounded-full bg-slate-100">
        <div
          className="absolute inset-y-0 rounded-full bg-teal-700/30"
          style={{ left: pctOf(prediction.low), width: pctOf(prediction.high - prediction.low) }}
        />
        <div
          className="absolute inset-y-0 w-1 -translate-x-1/2 rounded-full bg-teal-700"
          style={{ left: pctOf(prediction.mid) }}
        />
        {target ? (
          <div
            className="absolute -inset-y-1 w-0.5 -translate-x-1/2 bg-slate-900"
            style={{ left: pctOf(target) }}
          />
        ) : null}
      </div>

      {target ? (
        <p className="text-pretty">
          {gap && gap > 0 ? (
            <>
              Your target is <span className="font-semibold tabular-nums">{target}</span>. You need
              about <span className="font-semibold tabular-nums">{gap} more marks</span>.
            </>
          ) : (
            <>
              You’re at or above your target of{' '}
              <span className="font-semibold tabular-nums">{target}</span>. Keep it steady.
            </>
          )}
        </p>
      ) : null}

      {!compact && (
        <p className="flex gap-2 text-sm text-pretty text-slate-600">
          <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {prediction.status === 'early'
            ? 'Based on only a few questions per subject, so the range is wide. It narrows as you practise.'
            : 'This is an estimate from your answers, not a guarantee. It updates after each mock.'}
          {prediction.speedFactor < 1 &&
            ' You are answering slower than exam pace, which lowers the estimate.'}
        </p>
      )}
    </Card>
  );
}
