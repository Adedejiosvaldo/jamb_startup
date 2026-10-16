import { Lock } from 'lucide-react';
import { ButtonLink } from '@/components/ui/button';
import type { OptionKey } from '@/lib/types';

/** F-PRAC-04: why the right answer is right AND why the chosen wrong one is wrong. */
export function Explanation({
  correctOption,
  chosenOption,
  explanationCorrect,
  explanationsWrong,
  locked,
}: {
  correctOption: OptionKey;
  chosenOption: OptionKey | null;
  explanationCorrect: string | null;
  explanationsWrong: Partial<Record<OptionKey, string>> | null;
  locked: boolean;
}) {
  if (locked) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
        <Lock aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-slate-500" />
        <div>
          <p className="text-pretty">
            The answer is <strong>{correctOption}</strong>. Step-by-step explanations come with the
            Season Pass.
          </p>
          <ButtonLink href="/upgrade" size="sm" variant="secondary" className="mt-2">
            See the Season Pass
          </ButtonLink>
        </div>
      </div>
    );
  }
  const wrong =
    chosenOption && chosenOption !== correctOption ? explanationsWrong?.[chosenOption] : null;
  if (!explanationCorrect && !wrong) return null;
  return (
    <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
      {wrong && (
        <p className="text-pretty">
          <strong>Why {chosenOption} is wrong:</strong> {wrong}
        </p>
      )}
      {explanationCorrect && (
        <p className="text-pretty">
          <strong>Why {correctOption} is right:</strong> {explanationCorrect}
        </p>
      )}
    </div>
  );
}
