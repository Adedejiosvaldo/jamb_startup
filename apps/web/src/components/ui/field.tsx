import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { cn } from '@/lib/cn';

export const inputClass =
  'block min-h-12 w-full rounded-xl border border-line-strong bg-white/[0.03] px-4 py-3 text-base text-fg placeholder:text-faint transition-colors duration-150 focus:border-accent focus:bg-white/[0.05] focus:outline-none focus:ring-4 focus:ring-accent/15 aria-[invalid=true]:border-red-400 disabled:opacity-50';

interface FieldShellProps {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  required?: boolean;
  children: (ids: { id: string; describedBy: string | undefined; invalid: boolean }) => ReactNode;
  className?: string;
}

/** Label + control + hint + error, wired for screen readers (fixing-accessibility §5). */
export function FieldShell({ label, hint, error, required, children, className }: FieldShellProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={id} className="block text-sm font-medium text-fg-2">
        {label}
        {required && (
          <span aria-hidden="true" className="text-red-400">
            {' '}
            *
          </span>
        )}
      </label>
      {children({ id, describedBy, invalid: !!error })}
      {hint && (
        <p id={hintId} className="text-[13px] text-pretty text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-sm text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}

type Common = { label: ReactNode; hint?: ReactNode; error?: string | null; className?: string };

export function Field({
  label,
  hint,
  error,
  className,
  ...input
}: Common & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <FieldShell
      label={label}
      hint={hint}
      error={error}
      required={input.required}
      className={className}
    >
      {({ id, describedBy, invalid }) => (
        <input
          id={id}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          className={inputClass}
          {...input}
        />
      )}
    </FieldShell>
  );
}

export function SelectField({
  label,
  hint,
  error,
  className,
  children,
  ...select
}: Common & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <FieldShell
      label={label}
      hint={hint}
      error={error}
      required={select.required}
      className={className}
    >
      {({ id, describedBy, invalid }) => (
        <select
          id={id}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          className={cn(inputClass, 'pr-8')}
          {...select}
        >
          {children}
        </select>
      )}
    </FieldShell>
  );
}

export function TextareaField({
  label,
  hint,
  error,
  className,
  ...ta
}: Common & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <FieldShell
      label={label}
      hint={hint}
      error={error}
      required={ta.required}
      className={className}
    >
      {({ id, describedBy, invalid }) => (
        <textarea
          id={id}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          className={cn(inputClass, 'min-h-28')}
          {...ta}
        />
      )}
    </FieldShell>
  );
}
