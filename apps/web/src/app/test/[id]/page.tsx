'use client';

import {
  Calculator as CalcIcon,
  ChevronLeft,
  ChevronRight,
  CloudOff,
  Flag,
  Grid3x3,
  Loader2,
  Maximize,
  Check,
} from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Calculator } from '@/components/cbt/calculator';
import { Explanation } from '@/components/cbt/explanation';
import { Navigator, NavigatorLegend } from '@/components/cbt/navigator';
import { OptionButton } from '@/components/cbt/option-button';
import { ReportQuestion } from '@/components/cbt/report-question';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ConfirmDialog, Dialog } from '@/components/ui/dialog';
import { PageSkeleton } from '@/components/ui/skeleton';
import { api, ApiError, errorMessage, storage, track } from '@/lib/api';
import { cn } from '@/lib/cn';
import { clock } from '@/lib/format';
import { useRequireAuth } from '@/lib/session';
import { TEST_LABELS, type OptionKey, type TestPayload } from '@/lib/types';

interface Answer {
  chosenOption: OptionKey | null;
  flagged: boolean;
  timeSpentMs: number;
}
interface Pending extends Partial<Answer> {
  position: number;
  answeredAt: string;
}
interface Feedback {
  chosenOption: OptionKey;
  isCorrect: boolean;
  correctOption: OptionKey;
  explanationCorrect: string | null;
  explanationsWrong: Partial<Record<OptionKey, string>> | null;
}
type SaveState = 'saved' | 'saving' | 'offline' | 'error';

const LETTERS: OptionKey[] = ['A', 'B', 'C', 'D'];
const CALC_SUBJECTS = new Set(['MTH', 'PHY', 'CHM', 'ECO', 'ACC']);

export default function TestRunner() {
  useRequireAuth();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const cacheKey = `sc.test.${id}`;
  const pendingKey = `sc.pending.${id}`;

  const [test, setTest] = useState<TestPayload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<number, Answer>>({});
  const [feedback, setFeedback] = useState<Record<number, Feedback>>({});
  const [index, setIndex] = useState(0);
  const [save, setSave] = useState<SaveState>('saved');
  const [now, setNow] = useState(() => Date.now());
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [gridOpen, setGridOpen] = useState(false);
  const [calcOpen, setCalcOpen] = useState(false);
  const [checking, setChecking] = useState(false);

  const pending = useRef<Record<number, Pending>>({});
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shownAt = useRef(Date.now());
  const autoSubmitted = useRef(false);
  const wasOffline = useRef(false);

  const isPractice = test?.type === 'practice';

  // ── load (network first, cached copy if offline) ──
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let payload: TestPayload | null = null;
      try {
        payload = await api<TestPayload>(`/v1/tests/${id}`);
        storage.set(cacheKey, JSON.stringify(payload));
      } catch (e) {
        const cached = storage.get(cacheKey);
        if (cached) payload = JSON.parse(cached) as TestPayload;
        else if (!cancelled) setLoadError(errorMessage(e));
      }
      if (!payload || cancelled) return;
      if (payload.submittedAt) {
        router.replace(`/test/${id}/results`);
        return;
      }
      const restored = JSON.parse(storage.get(pendingKey) ?? '{}') as Record<number, Pending>;
      pending.current = restored;
      const a: Record<number, Answer> = {};
      for (const it of payload.items) {
        const p = restored[it.position];
        a[it.position] = {
          chosenOption: p?.chosenOption !== undefined ? p.chosenOption : it.chosenOption,
          flagged: p?.flagged ?? it.flagged,
          timeSpentMs: p?.timeSpentMs ?? it.timeSpentMs ?? 0,
        };
      }
      setAnswers(a);
      // Resume at the first unanswered question.
      const firstOpen = payload.items.findIndex((it) => !a[it.position]?.chosenOption);
      setIndex(firstOpen === -1 ? 0 : firstOpen);
      setTest(payload);
      if (Object.keys(restored).length) scheduleFlush(0);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // ── autosave queue (spec §13.3: answers never lost) ──
  const persist = () => storage.set(pendingKey, JSON.stringify(pending.current));

  const flush = useCallback(async () => {
    const items = Object.values(pending.current);
    if (!items.length) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setSave('offline');
      wasOffline.current = true;
      return;
    }
    setSave('saving');
    try {
      await api(`/v1/tests/${id}/sync`, { method: 'POST', body: { items } });
      for (const it of items) {
        if (pending.current[it.position]?.answeredAt === it.answeredAt)
          delete pending.current[it.position];
      }
      persist();
      setSave(Object.keys(pending.current).length ? 'saving' : 'saved');
      if (wasOffline.current) {
        track('offline_sync_completed', { items: items.length });
        wasOffline.current = false;
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 0) {
        setSave('offline');
        wasOffline.current = true;
      } else if (e instanceof ApiError && e.code === 'ALREADY_SUBMITTED') {
        router.replace(`/test/${id}/results`);
      } else setSave('error');
    }
  }, [id]);

  const scheduleFlush = useCallback(
    (delay = 800) => {
      if (flushTimer.current) clearTimeout(flushTimer.current);
      flushTimer.current = setTimeout(() => void flush(), delay);
    },
    [flush],
  );

  useEffect(() => {
    const online = () => scheduleFlush(0);
    window.addEventListener('online', online);
    window.addEventListener('offline', () => setSave('offline'));
    return () => window.removeEventListener('online', online);
  }, [scheduleFlush]);

  function queue(position: number, patch: Partial<Answer>) {
    pending.current[position] = {
      ...pending.current[position],
      ...patch,
      position,
      answeredAt: new Date().toISOString(),
    };
    persist();
    scheduleFlush();
  }

  // ── time on question ──
  const items = test?.items ?? [];
  const current = items[index];
  const commitTime = useCallback(() => {
    if (!current) return;
    const spent = Date.now() - shownAt.current;
    shownAt.current = Date.now();
    if (spent < 300) return;
    setAnswers((a) => {
      const prev = a[current.position] ?? { chosenOption: null, flagged: false, timeSpentMs: 0 };
      const next = { ...prev, timeSpentMs: prev.timeSpentMs + spent };
      pending.current[current.position] = {
        ...pending.current[current.position],
        position: current.position,
        timeSpentMs: next.timeSpentMs,
        answeredAt: pending.current[current.position]?.answeredAt ?? new Date().toISOString(),
      };
      persist();
      return { ...a, [current.position]: next };
    });
  }, [current]);

  const go = useCallback(
    (i: number) => {
      if (!test) return;
      const target = Math.max(0, Math.min(test.items.length - 1, i));
      if (target === index) return;
      commitTime();
      scheduleFlush();
      setIndex(target);
      setGridOpen(false);
      window.scrollTo({ top: 0 });
    },
    [test, index, commitTime, scheduleFlush],
  );

  async function choose(letter: OptionKey) {
    if (!current) return;
    const pos = current.position;
    if (isPractice && (feedback[pos] || answers[pos]?.chosenOption)) return; // practice answers are final
    const spent = Date.now() - shownAt.current;
    shownAt.current = Date.now();
    const prev = answers[pos] ?? { chosenOption: null, flagged: false, timeSpentMs: 0 };
    const next: Answer = { ...prev, chosenOption: letter, timeSpentMs: prev.timeSpentMs + spent };
    setAnswers((a) => ({ ...a, [pos]: next }));

    if (!isPractice) {
      queue(pos, next);
      return;
    }
    // Practice: check immediately for instant feedback.
    setChecking(true);
    try {
      const res = await api<{ feedback?: Feedback }>(`/v1/tests/${id}/items/${pos}`, {
        method: 'PUT',
        body: {
          chosenOption: letter,
          timeSpentMs: next.timeSpentMs,
          answeredAt: new Date().toISOString(),
        },
      });
      if (res.feedback) setFeedback((f) => ({ ...f, [pos]: res.feedback! }));
      track('practice_answered', { correct: res.feedback?.isCorrect, time_ms: next.timeSpentMs });
    } catch {
      queue(pos, next); // offline: keep it, check on results
    } finally {
      setChecking(false);
    }
  }

  function toggleFlag() {
    if (!current) return;
    const pos = current.position;
    const prev = answers[pos] ?? { chosenOption: null, flagged: false, timeSpentMs: 0 };
    const next = { ...prev, flagged: !prev.flagged };
    setAnswers((a) => ({ ...a, [pos]: next }));
    queue(pos, { flagged: next.flagged });
  }

  // ── submit ──
  const submit = useCallback(async () => {
    if (!test || submitting) return;
    commitTime();
    setSubmitting(true);
    setSubmitError(null);
    try {
      const items = Object.values(pending.current);
      await api(`/v1/tests/${id}/submit`, { method: 'POST', body: { items } });
      storage.set(pendingKey, null);
      storage.set(cacheKey, null);
      if (test.type === 'diagnostic' || test.type === 'short_diagnostic')
        track('diagnostic_completed');
      router.replace(`/test/${id}/results`);
    } catch (e) {
      setSubmitting(false);
      setSubmitError(
        e instanceof ApiError && e.status === 0
          ? 'You’re offline. Your answers are safe on this phone — reconnect and tap Submit again.'
          : errorMessage(e),
      );
    }
  }, [test, submitting, id, router]);

  // ── timer ──
  const endsAt = test?.endsAt ? new Date(test.endsAt).getTime() : null;
  const remaining = endsAt ? Math.round((endsAt - now) / 1000) : null;
  const elapsed = test ? Math.round((now - new Date(test.startedAt).getTime()) / 1000) : 0;
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (remaining !== null && remaining <= 0 && !autoSubmitted.current && test) {
      autoSubmitted.current = true;
      void submit();
    }
  }, [remaining, test, submit]);

  // ── keyboard shortcuts (A–D, N, P, S) [VERIFY against the real JAMB CBT] ──
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' && (e.target as HTMLInputElement).type !== 'radio') return;
      if (tag === 'TEXTAREA' || confirmSubmit || calcOpen || gridOpen) return;
      const k = e.key.toUpperCase();
      if (LETTERS.includes(k as OptionKey)) {
        e.preventDefault();
        void choose(k as OptionKey);
      } else if (k === 'N' || e.key === 'ArrowRight') go(index + 1);
      else if (k === 'P' || e.key === 'ArrowLeft') go(index - 1);
      else if (k === 'S') setConfirmSubmit(true);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const subjectStarts = useMemo(() => {
    const m = new Map<string, number>();
    items.forEach((it, i) => {
      if (!m.has(it.subjectCode)) m.set(it.subjectCode, i);
    });
    return m;
  }, [items]);

  if (loadError) {
    return (
      <main id="main" className="mx-auto max-w-2xl px-4 py-10">
        <Alert tone="danger" title="We couldn’t open this test">
          {loadError}
        </Alert>
        <Button className="mt-4" variant="secondary" onClick={() => router.push('/home')}>
          Back to today
        </Button>
      </main>
    );
  }
  if (!test || !current) {
    return (
      <main id="main" className="mx-auto max-w-2xl px-4 py-10">
        <PageSkeleton />
      </main>
    );
  }

  const answeredCount = items.filter((it) => answers[it.position]?.chosenOption).length;
  const unanswered = items.length - answeredCount;
  const flaggedCount = items.filter((it) => answers[it.position]?.flagged).length;
  const subject = test.subjects.find((s) => s.code === current.subjectCode);
  const ans = answers[current.position];
  const fb = feedback[current.position];
  const navItems = items.map((it) => ({
    position: it.position,
    answered: !!answers[it.position]?.chosenOption,
    flagged: !!answers[it.position]?.flagged,
    correct: feedback[it.position] ? feedback[it.position]!.isCorrect : null,
  }));
  const lowTime = remaining !== null && remaining <= 300;
  const title = test.mode === 'review' ? 'Mistake review' : (TEST_LABELS[test.type] ?? 'Test');

  return (
    <div className="min-h-dvh bg-canvas pb-[calc(5rem+env(safe-area-inset-bottom))]">
      {/* Top bar */}
      <header className="sticky top-0 z-10 border-b border-line bg-surface">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{title}</p>
            <p className="flex items-center gap-1 text-xs text-muted" aria-live="polite">
              {save === 'saving' && (
                <>
                  <Loader2 aria-hidden="true" className="size-3 motion-safe:animate-spin" /> Saving…
                </>
              )}
              {save === 'saved' && (
                <>
                  <Check aria-hidden="true" className="size-3" /> All answers saved
                </>
              )}
              {save === 'offline' && (
                <>
                  <CloudOff aria-hidden="true" className="size-3" /> Offline — answers saved on this
                  phone
                </>
              )}
              {save === 'error' && <>Couldn’t save. Retrying…</>}
            </p>
          </div>
          <div
            role="timer"
            aria-label={
              remaining !== null ? `Time left ${clock(remaining)}` : `Time spent ${clock(elapsed)}`
            }
            className={cn(
              'rounded-lg px-3 py-1.5 font-mono text-lg font-semibold tabular-nums',
              lowTime ? 'bg-red-500/10 text-red-300' : 'bg-surface-2 text-fg',
            )}
          >
            {clock(remaining ?? elapsed)}
          </div>
          <Button size="sm" onClick={() => setConfirmSubmit(true)}>
            Submit
          </Button>
        </div>
        {/* Subject tabs */}
        {test.subjects.length > 1 && (
          <nav aria-label="Subjects" className="mx-auto max-w-5xl overflow-x-auto px-4">
            <ul className="flex gap-1">
              {test.subjects.map((s) => {
                const sItems = items.filter((it) => it.subjectCode === s.code);
                const done = sItems.filter((it) => answers[it.position]?.chosenOption).length;
                const active = s.code === current.subjectCode;
                return (
                  <li key={s.code}>
                    <button
                      type="button"
                      onClick={() => go(subjectStarts.get(s.code) ?? 0)}
                      aria-current={active ? 'true' : undefined}
                      className={cn(
                        'min-h-11 border-b-2 px-3 text-sm font-medium whitespace-nowrap',
                        active ? 'border-accent text-accent' : 'border-transparent text-muted',
                      )}
                    >
                      {s.name}{' '}
                      <span className="tabular-nums">
                        ({done}/{sItems.length})
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
        )}
      </header>

      <div className="mx-auto grid max-w-5xl gap-6 px-4 py-6 lg:grid-cols-[1fr_16rem]">
        <main id="main" className="min-w-0">
          <p className="text-sm font-medium text-muted tabular-nums">
            Question {index + 1} of {items.length}
            {subject && test.subjects.length > 1 ? ` · ${subject.name}` : ''}
          </p>
          <h1 className="mt-2 text-lg leading-relaxed text-pretty whitespace-pre-line text-fg">
            {current.stem}
          </h1>

          <fieldset
            className="mt-5 space-y-2.5"
            disabled={(isPractice && !!(fb || (ans?.chosenOption && !checking))) || submitting}
          >
            <legend className="sr-only">Choose an answer</legend>
            {LETTERS.map((l) => (
              <OptionButton
                key={l}
                letter={l}
                text={current.options[l]}
                selected={ans?.chosenOption === l}
                state={
                  fb
                    ? l === fb.correctOption
                      ? 'correct'
                      : l === fb.chosenOption
                        ? 'wrong'
                        : null
                    : null
                }
                onSelect={() => void choose(l)}
              />
            ))}
          </fieldset>

          {isPractice && checking && <p className="mt-3 text-sm text-muted">Checking…</p>}
          {isPractice && ans?.chosenOption && !fb && !checking && (
            <p className="mt-3 text-sm text-muted">
              Saved. You’ll see if it’s right when you’re back online.
            </p>
          )}
          {fb && (
            <div className="mt-4 space-y-3" aria-live="polite">
              <p
                className={cn('font-semibold', fb.isCorrect ? 'text-emerald-300' : 'text-red-300')}
              >
                {fb.isCorrect ? 'Correct!' : `Not quite. The answer is ${fb.correctOption}.`}
              </p>
              <Explanation
                correctOption={fb.correctOption}
                chosenOption={fb.chosenOption}
                explanationCorrect={fb.explanationCorrect}
                explanationsWrong={fb.explanationsWrong}
                locked={fb.explanationCorrect === null && fb.explanationsWrong === null}
              />
              <ReportQuestion questionId={current.questionId} />
            </div>
          )}

          <div className="mt-6 flex flex-wrap gap-2">
            {CALC_SUBJECTS.has(current.subjectCode) && (
              <Button variant="secondary" size="sm" onClick={() => setCalcOpen(true)}>
                <CalcIcon aria-hidden="true" className="size-4" /> Calculator
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="hidden lg:inline-flex"
              onClick={() =>
                void document.documentElement.requestFullscreen?.().catch(() => undefined)
              }
            >
              <Maximize aria-hidden="true" className="size-4" /> Full screen
            </Button>
          </div>
          <p className="mt-6 hidden text-xs text-muted lg:block">
            Keyboard: A–D to answer · N next · P previous · S submit
          </p>
        </main>

        {/* Desktop navigator */}
        <aside aria-label="All questions" className="hidden lg:block">
          <div className="sticky top-32 space-y-3 rounded-xl border border-line bg-surface p-4">
            <p className="text-sm font-semibold tabular-nums">
              {answeredCount} of {items.length} answered
            </p>
            <Navigator items={navItems} current={index} onJump={go} />
            <NavigatorLegend />
          </div>
        </aside>
      </div>

      {/* Bottom bar */}
      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-2">
          <Button
            variant="secondary"
            onClick={() => go(index - 1)}
            disabled={index === 0}
            aria-label="Previous question"
          >
            <ChevronLeft aria-hidden="true" className="size-5" />
            <span className="hidden sm:inline">Previous</span>
          </Button>
          <Button
            variant={ans?.flagged ? 'secondary' : 'ghost'}
            onClick={toggleFlag}
            aria-pressed={!!ans?.flagged}
          >
            <Flag
              aria-hidden="true"
              className={cn('size-4', ans?.flagged && 'fill-amber-400 text-amber-400')}
            />
            <span className="hidden sm:inline">{ans?.flagged ? 'Flagged' : 'Flag'}</span>
            <span className="sr-only sm:hidden">
              {ans?.flagged ? 'Remove flag' : 'Flag for review'}
            </span>
          </Button>
          <Button variant="ghost" className="lg:hidden" onClick={() => setGridOpen(true)}>
            <Grid3x3 aria-hidden="true" className="size-4" />
            <span className="tabular-nums">
              {answeredCount}/{items.length}
            </span>
          </Button>
          <div className="flex-1" />
          {index < items.length - 1 ? (
            <Button onClick={() => go(index + 1)}>
              Next <ChevronRight aria-hidden="true" className="size-5" />
            </Button>
          ) : (
            <Button onClick={() => setConfirmSubmit(true)}>Finish</Button>
          )}
        </div>
      </div>

      <Dialog
        open={gridOpen}
        onOpenChange={setGridOpen}
        title={`${answeredCount} of ${items.length} answered`}
      >
        <div className="max-h-[60dvh] space-y-3 overflow-y-auto">
          <Navigator items={navItems} current={index} onJump={go} />
          <NavigatorLegend />
        </div>
      </Dialog>
      <Dialog open={calcOpen} onOpenChange={setCalcOpen} title="Calculator">
        <Calculator />
      </Dialog>
      <ConfirmDialog
        open={confirmSubmit}
        onOpenChange={setConfirmSubmit}
        title="Submit your answers?"
        description={
          <>
            {unanswered > 0 ? (
              <>
                You have <strong className="tabular-nums">{unanswered}</strong> unanswered question
                {unanswered === 1 ? '' : 's'}
                {flaggedCount ? ` and ${flaggedCount} flagged` : ''}. Unanswered questions score
                zero.
              </>
            ) : (
              <>You’ve answered every question{flaggedCount ? ` (${flaggedCount} flagged)` : ''}.</>
            )}{' '}
            You can’t change answers after submitting.
          </>
        }
        confirmLabel={submitting ? 'Submitting…' : 'Submit'}
        cancelLabel="Keep going"
        busy={submitting}
        onConfirm={() => {
          setConfirmSubmit(false);
          void submit();
        }}
      />
      {(submitting || submitError) && (
        <div className="fixed inset-x-4 bottom-24 z-40 mx-auto max-w-md">
          {submitting ? (
            <Alert tone="info">Submitting and marking your answers…</Alert>
          ) : (
            <Alert
              tone="danger"
              action={
                <Button size="sm" className="mt-2" onClick={() => void submit()}>
                  Try again
                </Button>
              }
            >
              {submitError}
            </Alert>
          )}
        </div>
      )}
    </div>
  );
}
