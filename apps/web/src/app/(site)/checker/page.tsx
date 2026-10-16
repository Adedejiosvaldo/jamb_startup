'use client';

import { CheckCircle2, ExternalLink } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SelectField } from '@/components/ui/field';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { storage, track } from '@/lib/api';
import { supportWaLink } from '@/lib/config';
import { shortDate } from '@/lib/format';
import type { Requirement } from '@/lib/types';
import { useApi } from '@/lib/use-api';

interface University {
  id: string;
  name: string;
  shortName: string | null;
  state: string | null;
}

/** F-ACQ-01: works without an account. */
export default function CheckerPage() {
  const unis = useApi<University[]>('/v1/universities', { auth: false });
  const [universityId, setUniversityId] = useState('');
  const [courseId, setCourseId] = useState('');
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

  useEffect(() => {
    if (req.data) {
      storage.set('sc.target', JSON.stringify({ universityId, courseId }));
      track('checker_used', {
        university: req.data.university.shortName ?? req.data.university.name,
        course: req.data.course.name,
      });
    }
  }, [req.data, universityId, courseId]);

  const sortedUnis = useMemo(() => unis.data ?? [], [unis.data]);
  const report =
    req.data &&
    supportWaLink(
      `Wrong info on the checker: ${req.data.course.name} at ${req.data.university.name}.`,
    );

  return (
    <div>
      <PageHeader
        title="Subject combination checker"
        description="Pick a university and course to see the UTME subjects and O'Level results you need."
      />
      <div className="space-y-4">
        {unis.loading ? (
          <Skeleton className="h-16" />
        ) : (
          <SelectField
            label="University"
            value={universityId}
            onChange={(e) => {
              setUniversityId(e.target.value);
              setCourseId('');
            }}
          >
            <option value="">Choose a university</option>
            {sortedUnis.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
                {u.shortName ? ` (${u.shortName})` : ''}
              </option>
            ))}
          </SelectField>
        )}
        {universityId && (
          <SelectField
            label="Course"
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
            disabled={courses.loading}
          >
            <option value="">{courses.loading ? 'Loading courses…' : 'Choose a course'}</option>
            {courses.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </SelectField>
        )}
        {unis.error && <Alert tone="danger">{unis.error.message}</Alert>}
      </div>

      {req.loading && <Skeleton className="mt-6 h-48" />}
      {req.error && (
        <Alert tone="warning" className="mt-6">
          {req.error.message}
        </Alert>
      )}
      {req.data && (
        <Card className="mt-6 space-y-5">
          <div>
            <p className="text-sm text-slate-600">{req.data.university.name}</p>
            <h2 className="text-xl font-bold text-balance">{req.data.course.name}</h2>
          </div>

          <div>
            <h3 className="font-semibold">UTME subjects</h3>
            <ul className="mt-2 space-y-2">
              {req.data.utmeSubjects.required.map((s) => (
                <li key={s.code} className="flex items-center gap-2">
                  <CheckCircle2 aria-hidden="true" className="size-4 text-teal-700" />
                  {s.name}
                  {s.code !== 'ENG' && <span className="text-sm text-slate-600">(compulsory)</span>}
                </li>
              ))}
              {req.data.utmeSubjects.choose.map((g, i) => (
                <li key={i} className="flex items-start gap-2">
                  <CheckCircle2 aria-hidden="true" className="mt-1 size-4 text-teal-700" />
                  <span>
                    Any {g.count} of: {g.from.map((s) => s.name).join(', ')}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {req.data.olevelRequirements && (
            <div>
              <h3 className="font-semibold">O&apos;Level</h3>
              <p className="mt-1 text-pretty text-slate-700">{req.data.olevelRequirements}</p>
            </div>
          )}
          {req.data.notes && <Alert tone="warning">{req.data.notes}</Alert>}
          {req.data.cutoffScore && (
            <div>
              <h3 className="font-semibold">Competitiveness</h3>
              <p className="mt-1 text-slate-700">
                Last known cut-off:{' '}
                <span className="font-semibold tabular-nums">{req.data.cutoffScore}</span>. Past
                cut-offs are a guide only, not a guarantee of admission.
              </p>
            </div>
          )}

          <p className="text-sm text-slate-600">
            Source: {req.data.source}. Last checked {shortDate(req.data.checkedAt)}.{' '}
            {report && (
              <a
                className="inline-flex items-center gap-1 underline"
                href={report}
                target="_blank"
                rel="noreferrer"
              >
                Report wrong info <ExternalLink aria-hidden="true" className="size-3" />
              </a>
            )}
          </p>

          <div className="rounded-lg bg-teal-50 p-4">
            <p className="font-semibold text-balance">
              Is your score good enough for {req.data.course.name}?
            </p>
            <p className="mt-1 text-sm text-pretty text-slate-700">
              Take the free diagnostic to see your likely score and the gap to this course.
            </p>
            <ButtonLink href="/start" className="mt-3">
              Take the free diagnostic
            </ButtonLink>
          </div>
        </Card>
      )}
    </div>
  );
}
