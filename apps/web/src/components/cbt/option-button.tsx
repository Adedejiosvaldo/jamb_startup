import { Check, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { OptionKey } from '@/lib/types';

export function OptionButton({
  letter,
  text,
  selected,
  state,
  disabled,
  onSelect,
}: {
  letter: OptionKey;
  text: string;
  selected: boolean;
  /** After feedback: is this the right answer, or the wrong one the student chose? */
  state?: 'correct' | 'wrong' | null;
  disabled?: boolean;
  onSelect: () => void;
}) {
  return (
    <label
      className={cn(
        'flex min-h-12 cursor-pointer items-start gap-3 rounded-lg border-2 p-3 text-base has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-teal-700',
        state === 'correct'
          ? 'border-green-700 bg-green-50'
          : state === 'wrong'
            ? 'border-red-700 bg-red-50'
            : selected
              ? 'border-teal-700 bg-teal-50'
              : 'border-slate-200 bg-white hover:border-slate-300',
        disabled && 'cursor-default',
      )}
    >
      <input
        type="radio"
        name="option"
        className="sr-only"
        checked={selected}
        disabled={disabled}
        onChange={onSelect}
      />
      <span
        aria-hidden="true"
        className={cn(
          'grid size-7 shrink-0 place-items-center rounded-full border text-sm font-bold',
          state === 'correct'
            ? 'border-green-700 bg-green-700 text-white'
            : state === 'wrong'
              ? 'border-red-700 bg-red-700 text-white'
              : selected
                ? 'border-teal-700 bg-teal-700 text-white'
                : 'border-slate-300 text-slate-700',
        )}
      >
        {state === 'correct' ? (
          <Check className="size-4" />
        ) : state === 'wrong' ? (
          <X className="size-4" />
        ) : (
          letter
        )}
      </span>
      <span className="pt-0.5 text-pretty">
        <span className="sr-only">Option {letter}: </span>
        {text}
        {state === 'correct' && <span className="sr-only"> (correct answer)</span>}
        {state === 'wrong' && <span className="sr-only"> (your answer, wrong)</span>}
      </span>
    </label>
  );
}
