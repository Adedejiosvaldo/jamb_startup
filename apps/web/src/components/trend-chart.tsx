import { dayMonth } from '@/lib/format';
import type { Prediction } from '@/lib/types';

/**
 * F-PROG-01 predicted-score trend: one series (mid) with its range as a band,
 * plus the target as a reference line. A data table follows for screen readers.
 */
export function TrendChart({ history, target }: { history: Prediction[]; target: number | null }) {
  const W = 600;
  const H = 220;
  const pad = { l: 36, r: 12, t: 12, b: 28 };
  const values = history.flatMap((p) => [p.low, p.high]).concat(target ? [target] : []);
  const min = Math.max(0, Math.floor((Math.min(...values) - 20) / 20) * 20);
  const max = Math.min(400, Math.ceil((Math.max(...values) + 20) / 20) * 20);
  const x = (i: number) =>
    pad.l +
    (history.length === 1
      ? (W - pad.l - pad.r) / 2
      : (i * (W - pad.l - pad.r)) / (history.length - 1));
  const y = (v: number) => pad.t + ((max - v) * (H - pad.t - pad.b)) / Math.max(1, max - min);
  const ticks = Array.from({ length: 5 }, (_, i) => Math.round(min + ((max - min) * i) / 4));

  const band =
    history.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.high)}`).join(' ') +
    ' ' +
    [...history]
      .reverse()
      .map((p, j) => `L${x(history.length - 1 - j)},${y(p.low)}`)
      .join(' ') +
    ' Z';
  const line = history.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.mid)}`).join(' ');

  return (
    <figure>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label="Predicted score over time"
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="rgb(255 255 255 / 0.06)" />
            <text
              x={pad.l - 6}
              y={y(t) + 4}
              textAnchor="end"
              fontSize="11"
              fill="#a1a1aa"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {t}
            </text>
          </g>
        ))}
        {history.length > 1 && <path d={band} fill="#34d399" fillOpacity="0.12" />}
        {target ? (
          <g>
            <line
              x1={pad.l}
              x2={W - pad.r}
              y1={y(target)}
              y2={y(target)}
              stroke="#fafafa"
              strokeDasharray="4 4"
            />
            <text x={W - pad.r} y={y(target) - 6} textAnchor="end" fontSize="11" fill="#fafafa">
              Target {target}
            </text>
          </g>
        ) : null}
        <path d={line} fill="none" stroke="#34d399" strokeWidth="2.5" strokeLinejoin="round" />
        {history.map((p, i) => (
          <circle
            key={p.id}
            cx={x(i)}
            cy={y(p.mid)}
            r="4"
            fill="#fff"
            stroke="#34d399"
            strokeWidth="2"
          />
        ))}
        {history.map((p, i) =>
          i === 0 || i === history.length - 1 ? (
            <text
              key={`d${p.id}`}
              x={x(i)}
              y={H - 8}
              textAnchor={i === 0 && history.length > 1 ? 'start' : 'end'}
              fontSize="11"
              fill="#a1a1aa"
            >
              {dayMonth(p.createdAt)}
            </text>
          ) : null,
        )}
      </svg>
      <figcaption className="sr-only">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Predicted</th>
              <th>Range</th>
            </tr>
          </thead>
          <tbody>
            {history.map((p) => (
              <tr key={p.id}>
                <td>{dayMonth(p.createdAt)}</td>
                <td>{p.mid}</td>
                <td>
                  {p.low}–{p.high}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </figcaption>
    </figure>
  );
}
