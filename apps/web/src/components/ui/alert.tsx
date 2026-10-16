import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Tone = 'info' | 'success' | 'warning' | 'danger';
const tones: Record<Tone, { box: string; Icon: typeof Info }> = {
  info: { box: 'border-line bg-white/[0.03] text-fg-2', Icon: Info },
  success: { box: 'border-emerald-400/20 bg-emerald-500/10 text-emerald-200', Icon: CheckCircle2 },
  warning: { box: 'border-amber-400/20 bg-amber-500/10 text-amber-200', Icon: AlertTriangle },
  danger: { box: 'border-red-400/25 bg-red-500/10 text-red-200', Icon: XCircle },
};

/** Inline message shown next to the action that caused it. Errors announce themselves. */
export function Alert({
  tone = 'info',
  title,
  children,
  className,
  action,
}: {
  tone?: Tone;
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
  action?: ReactNode;
}) {
  const { box, Icon } = tones[tone];
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn('flex gap-3 rounded-xl border p-3.5 text-sm', box, className)}
    >
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 flex-1 space-y-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="text-pretty">{children}</div>}
        {action}
      </div>
    </div>
  );
}
