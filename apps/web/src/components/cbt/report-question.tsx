'use client';

import { Flag } from 'lucide-react';
import { useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Choice, ChoiceGroup } from '@/components/ui/choice';
import { Dialog } from '@/components/ui/dialog';
import { TextareaField } from '@/components/ui/field';
import { api, errorMessage, track } from '@/lib/api';

const REASONS = [
  ['wrong_answer', 'The marked answer is wrong'],
  ['typo', 'There is a typo'],
  ['unclear', 'The question is unclear'],
  ['wrong_explanation', 'The explanation is wrong'],
  ['other', 'Something else'],
] as const;

/** F-SUP-03 "Report wrong answer" — confirmed reports earn extra days. */
export function ReportQuestion({ questionId }: { questionId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<(typeof REASONS)[number][0]>('wrong_answer');
  const [note, setNote] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await api(`/v1/questions/${questionId}/report`, {
        method: 'POST',
        body: { reason, note: note || undefined },
      });
      track('question_reported', { reason });
      setDone(true);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-11 items-center gap-1.5 text-sm text-muted underline-offset-4 hover:underline"
      >
        <Flag aria-hidden="true" className="size-3.5" />
        Report a problem with this question
      </button>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setDone(false);
        }}
        title="Report this question"
      >
        {done ? (
          <Alert tone="success" title="Thank you">
            A subject teacher will check it. If you’re right, we’ll add extra days to your plan.
          </Alert>
        ) : (
          <div className="space-y-4">
            <ChoiceGroup legend="What's wrong?">
              {REASONS.map(([value, label]) => (
                <Choice
                  key={value}
                  name="reason"
                  checked={reason === value}
                  onChange={() => setReason(value)}
                  title={label}
                />
              ))}
            </ChoiceGroup>
            <TextareaField
              label="Details (optional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={1000}
            />
            {error && <Alert tone="danger">{error}</Alert>}
            <Button block loading={busy} onClick={() => void submit()}>
              Send report
            </Button>
          </div>
        )}
      </Dialog>
    </>
  );
}
