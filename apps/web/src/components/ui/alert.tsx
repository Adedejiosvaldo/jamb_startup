import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Tone = 'info' | 'success' | 'warning' | 'danger';
const tones: Record<Tone, { box: string; Icon: typeof Info }> = {
  info: { box: 'border-slate-200 bg-slate-50 text-slate-800', Icon: Info },
  success: { box: 'border-green-200 bg-green-50 text-green-800', Icon: CheckCircle2 },
  warning: { box: 'border-amber-200 bg-amber-50 text-amber-900', Icon: AlertTriangle },
  danger: { box: 'border-red-200 bg-red-50 text-red-800', Icon: XCircle },
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
      className={cn('flex gap-3 rounded-lg border p-3 text-sm', box, className)}
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
