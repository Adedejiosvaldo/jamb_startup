'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Choice, ChoiceGroup } from '@/components/ui/choice';
import { Field, SelectField } from '@/components/ui/field';
import { api, errorMessage, storage } from '@/lib/api';
import { useSession } from '@/lib/session';
import type { Requirement, Subject } from '@/lib/types';
import { useApi } from '@/lib/use-api';

const STEPS = ['About you', 'Your goal', 'Your subjects', 'Your routine', 'Add a parent'] as const;
const thisYear = new Date().getFullYear();
// UTME runs around April–May; after June you're preparing for next year's.
const defaultExamYear = new Date().getMonth() >= 5 ? thisYear + 1 : thisYear;

export default function OnboardingPage() {
  const router = useRouter();
  const { me, reload } = useSession();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const [name, setName] = useState(me?.name ?? '');
  const [examYear, setExamYear] = useState(me?.examYear ?? defaultExamYear);
  const [track, setTrack] = useState<'first_timer' | 'retaker'>(
    me?.profile?.track ?? 'first_timer',
  );
  const [lastScore, setLastScore] = useState(me?.profile?.lastUtmeScore?.toString() ?? '');
  const [universityId, setUniversityId] = useState(me?.profile?.targetUniversity?.id ?? '');
  const [courseId, setCourseId] = useState(me?.profile?.targetCourse?.id ?? '');
  const [subjects, setSubjects] = useState<string[]>(
    me?.subjects.filter((s) => s.code !== 'ENG').map((s) => s.code) ?? [],
  );
  const [minutes, setMinutes] = useState(me?.profile?.dailyMinutes ?? 40);
  const [device, setDevice] = useState(me?.profile?.deviceType ?? 'phone');
  const [parentPhone, setParentPhone] = useState('');
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  // Prefill target from the subject checker.
  useEffect(() => {
    const raw = storage.get('sc.target');
    if (raw && !universityId) {
      try {
        const t = JSON.parse(raw) as { universityId: string; courseId: string };
        setUniversityId(t.universityId);
        setCourseId(t.courseId);
      } catch {
        /* ignore */
      }
    }
  }, []);

  const unis = useApi<{ id: string; name: string; shortName: string | null }[]>(
    '/v1/universities',
    { auth: false },
  );
  const courses = useApi<{ id: string; name: string }[]>(
    universityId ? `/v1/courses?university=${universityId}` : null,
    { auth: false },
  );
  const req = useApi<Requirement>(
    universityId && courseId
      ? `/v1/requirements?university=${universityId}&course=${courseId}`
      : null,
    { auth: false },
  );
  const allSubjects = useApi<Subject[]>('/v1/subjects', { auth: false });

  // Suggest the target course's compulsory subjects.
  useEffect(() => {
    if (req.data && subjects.length === 0) {
      setSubjects(
        req.data.utmeSubjects.required
          .map((s) => s.code)
          .filter((c) => c !== 'ENG')
          .slice(0, 3),
      );
    }
  }, [req.data, subjects.length]);

  const recommended = useMemo(() => {
    if (!req.data) return new Set<string>();
    return new Set(
      [
        ...req.data.utmeSubjects.required,
        ...req.data.utmeSubjects.choose.flatMap((g) => g.from),
      ].map((s) => s.code),
    );
  }, [req.data]);

  async function save(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const next = () => setStep((s) => Math.min(STEPS.length - 1, s + 1));

  const steps = [
    // 1. About you
    <form
      key="about"
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        void save(async () => {
          await api('/v1/me', {
            method: 'PATCH',
            body: {
              name: name.trim(),
              examYear,
              track,
              lastUtmeScore: track === 'retaker' && lastScore ? Number(lastScore) : null,
            },
          });
          next();
        });
      }}
    >
      <Field
        label="Full name"
        autoComplete="name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
      <SelectField
        label="Exam year"
        value={examYear}
        onChange={(e) => setExamYear(Number(e.target.value))}
      >
        {[defaultExamYear, defaultExamYear + 1].map((y) => (
          <option key={y} value={y}>
            UTME {y}
          </option>
        ))}
      </SelectField>
      <ChoiceGroup columns={2} legend="Written JAMB before?">
        <Choice
          name="track"
          checked={track === 'first_timer'}
          onChange={() => setTrack('first_timer')}
          title="First time"
        />
        <Choice
          name="track"
          checked={track === 'retaker'}
          onChange={() => setTrack('retaker')}
          title="Retaking"
        />
      </ChoiceGroup>
      {track === 'retaker' && (
        <Field
          label="Your last UTME score (optional)"
          inputMode="numeric"
          value={lastScore}
          onChange={(e) => setLastScore(e.target.value.replace(/\D/g, '').slice(0, 3))}
        />
      )}
      <Button type="submit" block loading={busy} disabled={!name.trim()}>
        Continue
      </Button>
    </form>,

    // 2. Target
    <form
      key="target"
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        void save(async () => {
          await api('/v1/me', {
            method: 'PATCH',
            body: { targetUniversityId: universityId || null, targetCourseId: courseId || null },
          });
          next();
        });
      }}
    >
      <SelectField
        label="University"
        value={universityId}
        onChange={(e) => {
          setUniversityId(e.target.value);
          setCourseId('');
        }}
      >
        <option value="">Not sure yet</option>
        {unis.data?.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name}
          </option>
        ))}
      </SelectField>
      {universityId && (
        <SelectField label="Course" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
          <option value="">Not sure yet</option>
          {courses.data?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </SelectField>
      )}
      {req.data?.cutoffScore && (
        <Alert tone="info">
          {req.data.course.name} at {req.data.university.shortName ?? req.data.university.name} last
          needed about <span className="font-semibold tabular-nums">{req.data.cutoffScore}</span>.
          We’ll use that as your target. You can change it later.
        </Alert>
      )}
      <Button type="submit" block loading={busy}>
        Continue
      </Button>
    </form>,

    // 3. Subjects
    <form
      key="subjects"
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        void save(async () => {
          const res = await api<{ warnings: string[] }>('/v1/me/subjects', {
            method: 'PUT',
            body: { subjectCodes: subjects },
          });
          setWarnings(res.warnings);
          if (!res.warnings.length) next();
        });
      }}
    >
      <ChoiceGroup
        columns={2}
        legend="Pick 3 — English is included"
        hint={`${subjects.length} of 3 chosen`}
      >
        {allSubjects.data
          ?.filter((s) => s.code !== 'ENG')
          .sort((a, b) => Number(recommended.has(b.code)) - Number(recommended.has(a.code)))
          .map((s) => (
            <Choice
              key={s.code}
              type="checkbox"
              name="subjects"
              checked={subjects.includes(s.code)}
              disabled={subjects.length >= 3}
              onChange={() => {
                setWarnings([]);
                setSubjects((cur) =>
                  cur.includes(s.code) ? cur.filter((c) => c !== s.code) : [...cur, s.code],
                );
              }}
              title={s.name}
              description={recommended.has(s.code) ? 'Fits your course' : undefined}
            />
          ))}
      </ChoiceGroup>
      {warnings.length > 0 && (
        <Alert
          tone="warning"
          title="These subjects may not fit your course"
          action={
            <Button variant="secondary" size="sm" className="mt-2" onClick={next}>
              Keep my subjects anyway
            </Button>
          }
        >
          <ul className="list-disc pl-5">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </Alert>
      )}
      <Button type="submit" block loading={busy} disabled={subjects.length !== 3}>
        Continue
      </Button>
    </form>,

    // 4. Study time
    <form
      key="time"
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        void save(async () => {
          await api('/v1/me', {
            method: 'PATCH',
            body: { dailyMinutes: minutes, deviceType: device },
          });
          await reload();
          next();
        });
      }}
    >
      <ChoiceGroup columns={2} legend="Daily study time" hint="Pick what you’ll actually keep up.">
        {[20, 40, 60, 90].map((m) => (
          <Choice
            key={m}
            name="minutes"
            checked={minutes === m}
            onChange={() => setMinutes(m)}
            title={`${m} min`}
            description={m === 40 ? 'Popular' : undefined}
          />
        ))}
      </ChoiceGroup>
      <ChoiceGroup legend="Mostly studying on">
        <Choice
          name="device"
          checked={device === 'phone'}
          onChange={() => setDevice('phone')}
          title="My phone"
        />
        <Choice
          name="device"
          checked={device === 'laptop'}
          onChange={() => setDevice('laptop')}
          title="A laptop or computer"
        />
        <Choice
          name="device"
          checked={device === 'both'}
          onChange={() => setDevice('both')}
          title="Both"
        />
      </ChoiceGroup>
      <Button type="submit" block loading={busy}>
        Continue
      </Button>
    </form>,

    // 5. Parent
    <div key="parent" className="space-y-5">
      <p className="text-pretty text-fg-2">
        Optional. They get one WhatsApp update each Sunday — only if they agree.
      </p>
      {shareUrl ? (
        <Alert tone="success" title="Almost done">
          Send them the request on WhatsApp so they can agree.
          <a
            href={shareUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-2 block font-semibold underline"
          >
            Open WhatsApp
          </a>
        </Alert>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void save(async () => {
              const res = await api<{ shareUrl: string }>('/v1/me/parent-link', {
                method: 'POST',
                body: { parentPhone },
              });
              setShareUrl(res.shareUrl);
            });
          }}
        >
          <Field
            label="Parent's WhatsApp number"
            type="tel"
            inputMode="tel"
            placeholder="0803 123 4567"
            value={parentPhone}
            onChange={(e) => setParentPhone(e.target.value)}
          />
          <Button
            type="submit"
            variant="secondary"
            block
            loading={busy}
            disabled={!parentPhone.trim()}
          >
            Add parent
          </Button>
        </form>
      )}
      <Button block onClick={() => router.replace('/home')}>
        {shareUrl ? 'Go to my plan' : 'Skip for now'}
      </Button>
    </div>,
  ];

  return (
    <div>
      <p className="text-sm font-medium text-muted tabular-nums">
        Step {step + 1} of {STEPS.length}
      </p>
      <div className="mt-2 flex gap-1" aria-hidden="true">
        {STEPS.map((s, i) => (
          <span
            key={s}
            className={`h-1 flex-1 rounded-full ${i <= step ? 'bg-accent' : 'bg-white/10'}`}
          />
        ))}
      </div>
      <h1 className="mt-6 mb-8 text-3xl font-semibold text-balance">{STEPS[step]}</h1>
      {steps[step]}
      {error && (
        <Alert tone="danger" className="mt-4">
          {error}
        </Alert>
      )}
      {step > 0 && (
        <button
          type="button"
          className="mt-4 min-h-11 text-sm underline"
          onClick={() => setStep((s) => s - 1)}
        >
          Back
        </button>
      )}
    </div>
  );
}
