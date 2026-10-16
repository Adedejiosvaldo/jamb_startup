import { cn } from '@/lib/cn';

/**
 * Signature gauge: predicted score out of 400 as a ring. The faint band is
 * the likely range, the bright arc the most likely score, the tick the target.
 */
export function ScoreRing({
  low,
  mid,
  high,
  target,
  size = 200,
  label = 'Predicted',
  className,
}: {
  low: number;
  mid: number;
  high: number;
  target?: number | null;
  size?: number;
  label?: string;
  className?: string;
}) {
  const stroke = size * 0.07;
  const r = (size - stroke) / 2 - 6;
  const c = 2 * Math.PI * r;
  const sweep = 0.75; // 270° gauge
  const arc = c * sweep;
  const frac = (v: number) => Math.max(0, Math.min(1, v / 400));
  const rot = 135; // start at bottom-left
  const targetAngle = ((rot + frac(target ?? 0) * 270) * Math.PI) / 180;
  const cx = size / 2;
  const tx1 = cx + (r - stroke * 0.9) * Math.cos(targetAngle);
  const ty1 = cx + (r - stroke * 0.9) * Math.sin(targetAngle);
  const tx2 = cx + (r + stroke * 0.9) * Math.cos(targetAngle);
  const ty2 = cx + (r + stroke * 0.9) * Math.sin(targetAngle);
  const gid = `ring-${size}`;

  return (
    <div
      className={cn('relative grid place-items-center', className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <defs>
          <linearGradient id={gid} x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stopColor="#059669" />
            <stop offset="1" stopColor="#6ee7b7" />
          </linearGradient>
        </defs>
        <g transform={`rotate(${rot} ${cx} ${cx})`}>
          <circle
            cx={cx}
            cy={cx}
            r={r}
            fill="none"
            stroke="rgb(255 255 255 / 0.07)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${arc} ${c}`}
          />
          <circle
            cx={cx}
            cy={cx}
            r={r}
            fill="none"
            stroke="rgb(52 211 153 / 0.18)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${arc * (frac(high) - frac(low))} ${c}`}
            strokeDashoffset={-arc * frac(low)}
          />
          <circle
            cx={cx}
            cy={cx}
            r={r}
            fill="none"
            stroke={`url(#${gid})`}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${arc * frac(mid)} ${c}`}
          />
        </g>
        {target ? (
          <line
            x1={tx1}
            y1={ty1}
            x2={tx2}
            y2={ty2}
            stroke="#fafafa"
            strokeWidth={2.5}
            strokeLinecap="round"
          />
        ) : null}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="text-[11px] font-medium text-muted uppercase">{label}</p>
          <p
            className="font-semibold text-fg tabular-nums"
            style={{ fontSize: size * 0.24, lineHeight: 1.05 }}
          >
            {mid}
          </p>
          <p className="text-xs text-muted tabular-nums">
            {low}–{high}
          </p>
        </div>
      </div>
    </div>
  );
}
