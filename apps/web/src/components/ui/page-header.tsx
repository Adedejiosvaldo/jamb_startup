import type { ReactNode } from 'react';

export function PageHeader({
  title,
  description,
  action,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0 space-y-1">
        <h1 className="text-2xl font-bold text-balance text-fg">{title}</h1>
        {description && <p className="text-pretty text-muted">{description}</p>}
      </div>
      {action}
    </header>
  );
}
