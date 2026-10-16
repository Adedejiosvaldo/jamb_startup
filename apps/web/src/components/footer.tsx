import Link from 'next/link';

export function Footer() {
  return (
    <footer className="mx-auto max-w-2xl px-4 py-8 text-sm text-slate-600">
      <nav aria-label="Footer" className="flex flex-wrap gap-x-4 gap-y-2">
        <Link className="underline-offset-4 hover:underline" href="/help">
          Help
        </Link>
        <Link className="underline-offset-4 hover:underline" href="/privacy">
          Privacy
        </Link>
        <Link className="underline-offset-4 hover:underline" href="/terms">
          Terms and refunds
        </Link>
        <Link className="underline-offset-4 hover:underline" href="/teachers">
          For lesson teachers
        </Link>
      </nav>
      <p className="mt-4">
        ScoreCoach is an independent study service and is not affiliated with JAMB.
      </p>
    </footer>
  );
}
