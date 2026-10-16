import type { ReactNode } from 'react';

/** Long-form text styling for help and legal pages. */
export function Prose({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-4 text-pretty text-slate-800 [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-balance [&_h3]:mt-6 [&_h3]:font-semibold [&_li]:mt-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5">
      {children}
    </div>
  );
}
