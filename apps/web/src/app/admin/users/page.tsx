'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Table } from '@/components/admin/table';
import { Badge } from '@/components/ui/badge';
import { Field } from '@/components/ui/field';
import { PageHeader } from '@/components/ui/page-header';
import { dateTime } from '@/lib/format';
import { useApi } from '@/lib/use-api';

interface U {
  id: string;
  phone: string;
  name: string | null;
  role: string;
  status: string;
  examYear: number | null;
  createdAt: string;
  lastSeenAt: string | null;
}

export default function UsersPage() {
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const list = useApi<U[]>(`/v1/admin/users?q=${encodeURIComponent(search)}`);
  return (
    <div className="space-y-4">
      <PageHeader title="Users" description="Search by phone number or name." />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(q);
        }}
      >
        <Field
          label="Phone or name"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="0803…"
        />
      </form>
      <Table
        caption="Users"
        rows={list.data ?? []}
        rowKey={(u) => u.id}
        empty={list.loading ? 'Loading…' : 'No users found.'}
        columns={[
          {
            header: 'User',
            cell: (u) => (
              <Link
                href={`/admin/users/${u.id}`}
                className="font-medium text-teal-800 underline-offset-4 hover:underline"
              >
                {u.name ?? 'No name'} · {u.phone}
              </Link>
            ),
          },
          {
            header: 'Role',
            cell: (u) => <Badge tone={u.role === 'student' ? 'neutral' : 'accent'}>{u.role}</Badge>,
          },
          { header: 'Exam', cell: (u) => u.examYear ?? '—' },
          {
            header: 'Joined',
            cell: (u) => <span className="whitespace-nowrap">{dateTime(u.createdAt)}</span>,
          },
          {
            header: 'Last seen',
            cell: (u) =>
              u.lastSeenAt ? (
                <span className="whitespace-nowrap">{dateTime(u.lastSeenAt)}</span>
              ) : (
                '—'
              ),
          },
        ]}
      />
    </div>
  );
}
