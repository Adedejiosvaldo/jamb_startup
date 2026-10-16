import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** Big tappable radio/checkbox cards built on native inputs (keyboard + screen reader for free). */
export function ChoiceGroup({
  legend,
  hint,
  children,
  className,
}: {
  legend: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <fieldset className={cn('space-y-2', className)}>
      <legend className="text-sm font-medium text-slate-900">{legend}</legend>
      {hint && <p className="text-sm text-slate-600">{hint}</p>}
      <div className="grid gap-2">{children}</div>
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
        'flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border p-3 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-teal-700',
        checked ? 'border-teal-700 bg-teal-50' : 'border-slate-300 bg-white',
        disabled && !checked && 'cursor-not-allowed opacity-50',
      )}
    >
      <input
        type={type}
        name={name}
        checked={checked}
        onChange={onChange}
        disabled={disabled && !checked}
        className="mt-1 size-4 accent-teal-700"
      />
      <span className="min-w-0">
        <span className="block font-medium">{title}</span>
        {description && <span className="block text-sm text-slate-600">{description}</span>}
      </span>
    </label>
  );
}
