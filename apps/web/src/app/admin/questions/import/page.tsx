'use client';

import { useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { TextareaField } from '@/components/ui/field';
import { PageHeader } from '@/components/ui/page-header';
import { api } from '@/lib/api';
import { useAction } from '@/lib/use-action';

const COLUMNS = [
  'subjectCode',
  'topicName',
  'stem',
  'A',
  'B',
  'C',
  'D',
  'correctOption',
  'explanationCorrect',
  'whyA',
  'whyB',
  'whyC',
  'whyD',
  'difficulty',
  'source',
  'pastYear',
];

/** Minimal CSV parser: commas, quoted fields with "" escapes, newlines inside quotes. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      if (row.some((f) => f.trim())) rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f.trim())) rows.push(row);
  return rows;
}

function toRows(text: string): unknown[] {
  const trimmed = text.trim();
  if (trimmed.startsWith('[')) return JSON.parse(trimmed) as unknown[];
  const [header, ...data] = parseCsv(trimmed);
  if (!header) return [];
  const idx = (name: string) => header.findIndex((h) => h.trim() === name);
  return data.map((r) => {
    const get = (n: string) => (idx(n) >= 0 ? (r[idx(n)]?.trim() ?? '') : '');
    const wrong = Object.fromEntries(
      (['A', 'B', 'C', 'D'] as const).map((l) => [l, get(`why${l}`)]).filter(([, v]) => v),
    );
    return {
      subjectCode: get('subjectCode').toUpperCase(),
      topicName: get('topicName'),
      stem: get('stem'),
      options: { A: get('A'), B: get('B'), C: get('C'), D: get('D') },
      correctOption: get('correctOption').toUpperCase(),
      explanationCorrect: get('explanationCorrect') || undefined,
      explanationsWrong: Object.keys(wrong).length ? wrong : undefined,
      difficulty: Number(get('difficulty')) || 2,
      source: get('source') || 'original',
      pastYear: Number(get('pastYear')) || null,
    };
  });
}

export default function ImportPage() {
  const [text, setText] = useState('');
  const [result, setResult] = useState<{
    imported: number;
    errors: { row: number; message: string }[];
  } | null>(null);
  const action = useAction();

  return (
    <div className="max-w-3xl space-y-4">
      <PageHeader
        title="Bulk import"
        description="Paste CSV (with a header row) or a JSON array. Everything imports as drafts for review. If any row is invalid, nothing is imported."
      />
      <Alert tone="info" title="CSV columns">
        <code className="text-xs break-all">{COLUMNS.join(',')}</code>
      </Alert>
      <label className="flex min-h-11 items-center gap-2 text-sm font-medium">
        Load a .csv file
        <input
          type="file"
          accept=".csv,.json,text/csv,application/json"
          className="text-sm"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void f.text().then(setText);
          }}
        />
      </label>
      <TextareaField
        label="Data"
        className="[&_textarea]:min-h-64 [&_textarea]:font-mono [&_textarea]:text-xs"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <Button
        loading={action.busy === 'import'}
        disabled={!text.trim()}
        onClick={() =>
          void action.run('import', async () => {
            const rows = toRows(text);
            setResult(await api('/v1/admin/questions/import', { method: 'POST', body: { rows } }));
          })
        }
      >
        Validate and import
      </Button>
      {action.error && <Alert tone="danger">{action.error}</Alert>}
      {result &&
        (result.errors.length ? (
          <Alert
            tone="danger"
            title={`${result.errors.length} rows need fixing — nothing imported`}
          >
            <ul className="mt-1 list-disc pl-5">
              {result.errors.slice(0, 50).map((e) => (
                <li key={e.row}>
                  Row {e.row}: {e.message}
                </li>
              ))}
            </ul>
          </Alert>
        ) : (
          <Alert tone="success">Imported {result.imported} draft questions.</Alert>
        ))}
    </div>
  );
}
