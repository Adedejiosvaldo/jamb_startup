import Link from 'next/link';

export function Logo({ href = '/' }: { href?: string }) {
  return (
    <Link href={href} className="inline-flex min-h-11 items-center gap-2 font-bold text-slate-900">
      <span
        aria-hidden="true"
        className="grid size-7 place-items-center rounded-md bg-teal-700 text-sm text-white"
      >
        S
      </span>
      ScoreCoach
    </Link>
  );
}
