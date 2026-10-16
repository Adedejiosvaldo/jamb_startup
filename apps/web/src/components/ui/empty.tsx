import type { ReactNode } from 'react';

/** Empty states always offer exactly one next action. */
export function Empty({
  title,
  children,
  action,
}: {
  title: ReactNode;
  children?: ReactNode;
  action: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center">
      <p className="font-semibold text-balance">{title}</p>
      {children && <p className="mt-1 text-sm text-pretty text-slate-600">{children}</p>}
      <div className="mt-4 flex justify-center">{action}</div>
    </div>
  );
}
