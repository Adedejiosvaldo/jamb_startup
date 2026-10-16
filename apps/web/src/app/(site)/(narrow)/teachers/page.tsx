import type { Metadata } from 'next';
import { Prose } from '@/components/prose';
import { ButtonLink } from '@/components/ui/button';

export const metadata: Metadata = { title: 'For lesson teachers' };

export default function TeachersPage() {
  return (
    <div className="space-y-8">
      <Prose>
        <h1 className="text-3xl font-bold text-balance">For JAMB lesson teachers</h1>
        <p className="text-lg">
          We don’t replace you. We show you which of your students are stuck on what — and you earn
          on every student who joins.
        </p>
        <h2>What you get</h2>
        <ul>
          <li>
            A free class dashboard: who studied this week, who has gone quiet, and the weakest
            topics across your class.
          </li>
          <li>Your own discount code for your students.</li>
          <li>
            A commission on every Season Pass bought with your code or by students in your class,
            paid monthly by bank transfer.
          </li>
        </ul>
        <h2>How it works</h2>
        <ol>
          <li>Sign up and tell us about your lesson. We call to verify you.</li>
          <li>Create a class and share the class code with your students.</li>
          <li>Use the dashboard to focus your lessons where the class is weakest.</li>
        </ol>
        <h2>Rules</h2>
        <ul>
          <li>No false claims like “guaranteed 300”. No spam.</li>
          <li>Commission is reversed if a payment is refunded.</li>
        </ul>
      </Prose>
      <ButtonLink href="/login?next=/teacher" size="lg">
        Apply as a teacher
      </ButtonLink>
    </div>
  );
}
