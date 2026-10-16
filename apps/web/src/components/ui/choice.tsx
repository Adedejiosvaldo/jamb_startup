import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** Big tappable radio/checkbox cards built on native inputs (keyboard + screen reader for free). */
export function ChoiceGroup({
  legend,
  hint,
  children,
  className,
  columns = 1,
}: {
  legend: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
  columns?: 1 | 2;
}) {
  return (
    <fieldset className={cn('space-y-2', className)}>
      <legend className="mb-1 text-sm font-medium text-fg-2">{legend}</legend>
      {hint && <p className="text-[13px] text-muted tabular-nums">{hint}</p>}
      <div className={cn('grid gap-2', columns === 2 && 'grid-cols-2')}>{children}</div>
    </fieldset>
  );
}

export function Choice({
  type = 'radio',
  name,
  checked,
  onChange,
  disabled,
  title,
  description,
}: {
  type?: 'radio' | 'checkbox';
  name: string;
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  title: ReactNode;
  description?: ReactNode;
}) {
  return (
    <label
      className={cn(
        'flex min-h-12 cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors duration-150 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent',
        checked
          ? 'border-emerald-400/50 bg-accent-soft'
          : 'border-line bg-white/[0.02] hover:bg-white/[0.05]',
        disabled && !checked && 'cursor-not-allowed opacity-40',
      )}
    >
      <input
        type={type}
        name={name}
        checked={checked}
        onChange={onChange}
        disabled={disabled && !checked}
        className="mt-0.5 size-4 shrink-0 accent-emerald-400"
      />
      <span className="min-w-0">
        <span className="block text-[15px] leading-5 font-medium">{title}</span>
        {description && (
          <span className="mt-0.5 block text-xs text-emerald-300/80">{description}</span>
        )}
      </span>
    </label>
  );
}
