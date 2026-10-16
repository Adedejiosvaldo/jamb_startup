import Link from 'next/link';
import { SUPPORT_WHATSAPP } from '@/lib/config';

// F-ACQ-04 placeholder. Server-rendered, no client JS needed to read it.
// Copy rules (spec §21): no fake testimonials, no invented statistics, no score guarantees.
export default function Home() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">
        JAMB UTME preparation
      </p>
      <h1 className="mt-2 text-3xl font-bold leading-tight">Get the score your course needs.</h1>
      <p className="mt-4 text-lg text-slate-700">
        Take a free diagnostic, see your likely score and the gap to your course, then follow a
        daily plan built around your weakest topics.
      </p>

      <ol className="mt-8 space-y-3 text-slate-800">
        <li>
          <strong>1. Check your subjects.</strong> Make sure your combination fits your course.
        </li>
        <li>
          <strong>2. Take the free diagnostic.</strong> CBT-style, about 40 minutes.
        </li>
        <li>
          <strong>3. Follow your plan.</strong> Short daily practice, weekly mock, weekly report to
          your parent.
        </li>
      </ol>

      <Link
        href="/login"
        className="mt-10 inline-flex min-h-11 items-center rounded-lg bg-teal-700 px-6 text-base font-semibold text-white hover:bg-teal-800"
      >
        Start free
      </Link>

      {SUPPORT_WHATSAPP && (
        <p className="mt-6 text-sm text-slate-600">
          Need help?{' '}
          <a className="underline" href={`https://wa.me/${SUPPORT_WHATSAPP}`}>
            Chat with us on WhatsApp
          </a>
          .
        </p>
      )}
    </main>
  );
}
