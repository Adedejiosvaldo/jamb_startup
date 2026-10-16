'use client';

import { useState } from 'react';
import { Table } from '@/components/admin/table';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { Field, SelectField, TextareaField } from '@/components/ui/field';
import { PageHeader } from '@/components/ui/page-header';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { shortDate } from '@/lib/format';
import type { Requirement, Subject } from '@/lib/types';
import { useAction } from '@/lib/use-action';
import { useApi } from '@/lib/use-api';

type Tab = 'requirements' | 'topics' | 'add';

/** "1:GOV,COM,ACC; 2:CRS,LIT" ⇄ choose groups. */
function parseChoose(s: string) {
  return s
    .split(';')
    .map((g) => g.trim())
    .filter(Boolean)
    .map((g) => {
      const [count, list] = g.split(':');
      return {
        count: Number(count) || 1,
        from: (list ?? '')
          .split(',')
          .map((c) => c.trim().toUpperCase())
          .filter(Boolean),
      };
    });
}

export default function CataloguePage() {
  const [tab, setTab] = useState<Tab>('requirements');
  const reqs = useApi<Requirement[]>('/v1/admin/requirements');
  const unis = useApi<{ id: string; name: string }[]>('/v1/universities', { auth: false });
  const courses = useApi<{ id: string; name: string }[]>('/v1/courses', { auth: false });
  const subjects = useApi<Subject[]>('/v1/subjects', { auth: false });
  const action = useAction();

  const blank = {
    universityId: '',
    courseId: '',
    required: 'ENG',
    choose: '',
    olevel: '',
    notes: '',
    cutoffScore: '',
    source: '',
    checkedAt: new Date().toISOString().slice(0, 10),
  };
  const [r, setR] = useState(blank);
  const [uniName, setUniName] = useState('');
  const [courseName, setCourseName] = useState('');
  const [topicSubject, setTopicSubject] = useState('ENG');
  const topics = useApi<
    { id: string; name: string; weight: string; learnability: string; syllabusRef: string | null }[]
  >(tab === 'topics' ? `/v1/subjects/${topicSubject}/topics` : null, { auth: false });
  const [newTopic, setNewTopic] = useState({ name: '', weight: '', syllabusRef: '' });

  const edit = (x: Requirement) => {
    setR({
      universityId: x.university.id,
      courseId: x.course.id,
      required: x.utmeSubjects.required.map((s) => s.code).join(','),
      choose: x.utmeSubjects.choose
        .map((g) => `${g.count}:${g.from.map((s) => s.code).join(',')}`)
        .join('; '),
      olevel: x.olevelRequirements ?? '',
      notes: x.notes ?? '',
      cutoffScore: x.cutoffScore?.toString() ?? '',
      source: x.source,
      checkedAt: new Date().toISOString().slice(0, 10),
    });
    setTab('add');
  };

  const tabs: [Tab, string][] = [
    ['requirements', 'Course requirements'],
    ['add', 'Add / edit requirement'],
    ['topics', 'Syllabus topics'],
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Courses & topics"
        description="Every requirement needs a source and a checked date (F-ACQ-01). Enter from the current JAMB brochure; have a second person double-check."
      />
      <div role="tablist" className="flex flex-wrap gap-1">
        {tabs.map(([t, label]) => (
          <button
            key={t}
            role="tab"
            type="button"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn(
              'min-h-10 rounded-lg px-3 text-sm font-medium',
              tab === t ? 'bg-accent text-on-accent' : 'bg-surface ring-1 ring-line',
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {action.error && <Alert tone="danger">{action.error}</Alert>}
      {action.notice && <Alert tone="success">{action.notice}</Alert>}

      {tab === 'requirements' && (
        <Table
          caption="Course requirements"
          rows={reqs.data ?? []}
          rowKey={(x) => x.id}
          empty={reqs.loading ? 'Loading…' : 'None yet.'}
          columns={[
            { header: 'University', cell: (x) => x.university.shortName ?? x.university.name },
            { header: 'Course', cell: (x) => x.course.name },
            {
              header: 'Subjects',
              cell: (x) => (
                <span className="text-xs">
                  {x.utmeSubjects.required.map((s) => s.code).join(', ')}
                  {x.utmeSubjects.choose
                    .map((g) => ` + ${g.count} of ${g.from.map((s) => s.code).join('/')}`)
                    .join('')}
                </span>
              ),
            },
            { header: 'Cut-off', cell: (x) => x.cutoffScore ?? '—' },
            {
              header: 'Checked',
              cell: (x) => (
                <span className="text-xs">
                  {shortDate(x.checkedAt)} · {x.source}
                </span>
              ),
            },
            {
              header: '',
              cell: (x) => (
                <Button size="sm" variant="secondary" onClick={() => edit(x)}>
                  Edit
                </Button>
              ),
            },
          ]}
        />
      )}

      {tab === 'add' && (
        <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
          <Card>
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                void action.run(
                  'req',
                  async () => {
                    await api('/v1/admin/requirements', {
                      method: 'PUT',
                      body: {
                        universityId: r.universityId,
                        courseId: r.courseId,
                        utmeSubjects: {
                          required: r.required
                            .split(',')
                            .map((c) => c.trim().toUpperCase())
                            .filter(Boolean),
                          choose: parseChoose(r.choose),
                        },
                        olevelRequirements: r.olevel || undefined,
                        notes: r.notes || undefined,
                        cutoffScore: r.cutoffScore ? Number(r.cutoffScore) : null,
                        source: r.source,
                        checkedAt: r.checkedAt,
                      },
                    });
                    setR(blank);
                    await reqs.reload();
                    setTab('requirements');
                  },
                  'Saved.',
                );
              }}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <SelectField
                  label="University"
                  value={r.universityId}
                  onChange={(e) => setR({ ...r, universityId: e.target.value })}
                  required
                >
                  <option value="">Choose…</option>
                  {unis.data?.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </SelectField>
                <SelectField
                  label="Course"
                  value={r.courseId}
                  onChange={(e) => setR({ ...r, courseId: e.target.value })}
                  required
                >
                  <option value="">Choose…</option>
                  {courses.data?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </SelectField>
              </div>
              <Field
                label="Compulsory subject codes"
                hint={`Comma-separated. Codes: ${subjects.data?.map((s) => s.code).join(', ') ?? ''}`}
                value={r.required}
                onChange={(e) => setR({ ...r, required: e.target.value })}
                required
              />
              <Field
                label="Choice groups"
                hint='Format "count:CODES; count:CODES", e.g. 1:GOV,COM,ACC'
                value={r.choose}
                onChange={(e) => setR({ ...r, choose: e.target.value })}
              />
              <TextareaField
                label="O'Level requirements"
                value={r.olevel}
                onChange={(e) => setR({ ...r, olevel: e.target.value })}
              />
              <Field
                label="Special notes"
                value={r.notes}
                onChange={(e) => setR({ ...r, notes: e.target.value })}
              />
              <div className="grid gap-3 sm:grid-cols-3">
                <Field
                  label="Last cut-off"
                  inputMode="numeric"
                  value={r.cutoffScore}
                  onChange={(e) => setR({ ...r, cutoffScore: e.target.value.replace(/\D/g, '') })}
                />
                <Field
                  label="Source"
                  placeholder="JAMB brochure 2026/27 p.112"
                  value={r.source}
                  onChange={(e) => setR({ ...r, source: e.target.value })}
                  required
                />
                <Field
                  label="Checked on"
                  type="date"
                  value={r.checkedAt}
                  onChange={(e) => setR({ ...r, checkedAt: e.target.value })}
                  required
                />
              </div>
              <Button type="submit" loading={action.busy === 'req'}>
                Save requirement
              </Button>
            </form>
          </Card>
          <div className="space-y-4">
            <Card className="space-y-2">
              <CardTitle>Add university</CardTitle>
              <Field label="Name" value={uniName} onChange={(e) => setUniName(e.target.value)} />
              <Button
                size="sm"
                variant="secondary"
                disabled={uniName.length < 3}
                loading={action.busy === 'uni'}
                onClick={() =>
                  void action.run(
                    'uni',
                    async () => {
                      await api('/v1/admin/universities', {
                        method: 'POST',
                        body: { name: uniName },
                      });
                      setUniName('');
                      await unis.reload();
                    },
                    'University added.',
                  )
                }
              >
                Add
              </Button>
            </Card>
            <Card className="space-y-2">
              <CardTitle>Add course</CardTitle>
              <Field
                label="Name"
                value={courseName}
                onChange={(e) => setCourseName(e.target.value)}
              />
              <Button
                size="sm"
                variant="secondary"
                disabled={courseName.length < 3}
                loading={action.busy === 'course'}
                onClick={() =>
                  void action.run(
                    'course',
                    async () => {
                      await api('/v1/admin/courses', {
                        method: 'POST',
                        body: { name: courseName },
                      });
                      setCourseName('');
                      await courses.reload();
                    },
                    'Course added.',
                  )
                }
              >
                Add
              </Button>
            </Card>
          </div>
        </div>
      )}

      {tab === 'topics' && (
        <div className="space-y-4">
          <SelectField
            label="Subject"
            value={topicSubject}
            onChange={(e) => setTopicSubject(e.target.value)}
            className="max-w-xs"
          >
            {subjects.data?.map((s) => (
              <option key={s.code} value={s.code}>
                {s.name}
              </option>
            ))}
          </SelectField>
          <Table
            caption="Topics"
            rows={topics.data ?? []}
            rowKey={(t) => t.id}
            columns={[
              { header: 'Topic', cell: (t) => t.name },
              { header: 'Syllabus ref', cell: (t) => t.syllabusRef ?? '—' },
              {
                header: 'Exam weight (0–1)',
                cell: (t) => (
                  <input
                    aria-label={`Weight for ${t.name}`}
                    defaultValue={Number(t.weight)}
                    inputMode="decimal"
                    className="w-20 rounded-md border border-line-strong px-2 py-1 tabular-nums"
                    onBlur={(e) => {
                      const v = Number(e.target.value);
                      if (v !== Number(t.weight) && v >= 0 && v <= 1)
                        void action.run(
                          t.id,
                          () =>
                            api(`/v1/admin/topics/${t.id}`, {
                              method: 'PATCH',
                              body: { weight: v },
                            }),
                          `Updated ${t.name}.`,
                        );
                    }}
                  />
                ),
              },
              {
                header: 'Learnability',
                cell: (t) => (
                  <input
                    aria-label={`Learnability for ${t.name}`}
                    defaultValue={Number(t.learnability)}
                    inputMode="decimal"
                    className="w-20 rounded-md border border-line-strong px-2 py-1 tabular-nums"
                    onBlur={(e) => {
                      const v = Number(e.target.value);
                      if (v !== Number(t.learnability) && v >= 0.1 && v <= 3)
                        void action.run(
                          t.id,
                          () =>
                            api(`/v1/admin/topics/${t.id}`, {
                              method: 'PATCH',
                              body: { learnability: v },
                            }),
                          `Updated ${t.name}.`,
                        );
                    }}
                  />
                ),
              },
            ]}
          />
          <Card>
            <CardTitle>Add topic to {topicSubject}</CardTitle>
            <form
              className="mt-3 grid gap-3 sm:grid-cols-4 sm:items-end"
              onSubmit={(e) => {
                e.preventDefault();
                void action.run(
                  'topic',
                  async () => {
                    await api('/v1/admin/topics', {
                      method: 'POST',
                      body: {
                        subjectCode: topicSubject,
                        name: newTopic.name,
                        weight: Number(newTopic.weight) || 0,
                        syllabusRef: newTopic.syllabusRef || undefined,
                      },
                    });
                    setNewTopic({ name: '', weight: '', syllabusRef: '' });
                    await topics.reload();
                  },
                  'Topic added.',
                );
              }}
            >
              <Field
                label="Name"
                className="sm:col-span-2"
                value={newTopic.name}
                onChange={(e) => setNewTopic({ ...newTopic, name: e.target.value })}
                required
              />
              <Field
                label="Weight"
                inputMode="decimal"
                value={newTopic.weight}
                onChange={(e) => setNewTopic({ ...newTopic, weight: e.target.value })}
              />
              <Field
                label="Syllabus ref"
                value={newTopic.syllabusRef}
                onChange={(e) => setNewTopic({ ...newTopic, syllabusRef: e.target.value })}
              />
              <Button
                type="submit"
                className="sm:justify-self-start"
                loading={action.busy === 'topic'}
              >
                Add topic
              </Button>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
