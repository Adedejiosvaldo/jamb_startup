'use client';

import { useRouter } from 'next/navigation';
import { QuestionForm } from '@/components/admin/question-form';
import { Alert } from '@/components/ui/alert';
import { PageHeader } from '@/components/ui/page-header';
import { api } from '@/lib/api';
import { useAction } from '@/lib/use-action';

export default function NewQuestion() {
  const router = useRouter();
  const action = useAction();
  return (
    <div className="max-w-3xl">
      <PageHeader
        title="New question"
        description="Saved as a draft. A different reviewer must approve it before it can go live."
      />
      <QuestionForm
        submitLabel="Save draft"
        busy={action.busy === 'save'}
        onSubmit={(q) =>
          void action.run('save', async () => {
            const row = await api<{ id: string }>('/v1/admin/questions', {
              method: 'POST',
              body: q,
            });
            router.push(`/admin/questions/${row.id}`);
          })
        }
      />
      {action.error && (
        <Alert tone="danger" className="mt-4">
          {action.error}
        </Alert>
      )}
    </div>
  );
}
