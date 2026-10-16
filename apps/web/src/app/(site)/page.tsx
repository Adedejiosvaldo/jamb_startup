import { CalendarCheck, ClipboardCheck, MessageCircle, Target } from 'lucide-react';
import { ButtonLink } from '@/components/ui/button';
import { SeasonPrice } from '@/components/season-price';
import { Track } from '@/components/track';

// F-ACQ-04. Server-rendered: readable without JavaScript.
// Copy rules (spec §21): no fake testimonials, no invented statistics, no score guarantees.
const STEPS = [
  {
    Icon: ClipboardCheck,
    title: 'Check your subjects',
    body: 'Make sure your four subjects fit the course and university you want. Free, no sign-up.',
  },
  {
    Icon: Target,
    title: 'Take the free diagnostic',
    body: 'A CBT-style test that shows your likely score range and the gap to your course.',
  },
  {
    Icon: CalendarCheck,
    title: 'Follow your daily plan',
    body: 'Short practice on your weakest high-value topics, a weekly mock, and mistakes that come back until you get them right.',
  },
];

const FAQ = [
  {
    q: 'Is this JAMB?',
    a: 'No. ScoreCoach is an independent study service. We are not affiliated with JAMB. Always confirm official dates and fees on jamb.gov.ng.',
  },
  {
    q: 'How accurate is the predicted score?',
    a: 'It is an estimate from your answers, shown as a range. The range is wide until you have answered enough questions in every subject, and it narrows as you practise. We never show a single exact number we cannot back up.',
  },
  {
    q: 'Does it work on my phone with little data?',
    a: 'Yes. ScoreCoach is text-first and light. Your answers are saved on your phone during a test, so a bad network will not lose your work.',
  },
  {
    q: 'Can my parent pay?',
    a: 'Yes. Tap “Ask my parent to pay” and send the link on WhatsApp. They can pay by card, bank transfer or USSD without creating an account.',
  },
  {
    q: 'What if I change phones?',
    a: 'Your plan is tied to your phone number, not your device. Sign in on the new phone and everything is still there. You can use up to two devices at a time.',
  },
];

export default function Home() {
  return (
    <div className="space-y-14">
      <Track name="landing_viewed" />
      <section>
        <p className="text-sm font-semibold text-teal-700">JAMB UTME preparation</p>
        <h1 className="mt-2 text-4xl font-bold text-balance">Get the score your course needs.</h1>
        <p className="mt-4 text-lg text-pretty text-slate-700">
          Find out your likely JAMB score today, see exactly which topics will close the gap to your
          course, and study a little every day with a plan that adapts to you.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <ButtonLink href="/start" size="lg">
            Take the free diagnostic
          </ButtonLink>
          <ButtonLink href="/checker" size="lg" variant="secondary">
            Check my subjects
          </ButtonLink>
        </div>
        <p className="mt-3 text-sm text-slate-600">
          Free to start. Sign in with your phone number — no password.
        </p>
      </section>

      <section aria-labelledby="how">
        <h2 id="how" className="text-2xl font-bold text-balance">
          How it works
        </h2>
        <ol className="mt-6 space-y-5">
          {STEPS.map(({ Icon, title, body }, i) => (
            <li key={title} className="flex gap-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-teal-50 text-teal-700">
                <Icon aria-hidden="true" className="size-5" />
              </span>
              <div>
                <h3 className="font-semibold">
                  <span className="sr-only">Step {i + 1}: </span>
                  {title}
                </h3>
                <p className="mt-1 text-pretty text-slate-700">{body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section
        aria-labelledby="parents"
        className="rounded-xl border border-slate-200 bg-slate-50 p-5"
      >
        <h2 id="parents" className="flex items-center gap-2 text-xl font-bold text-balance">
          <MessageCircle aria-hidden="true" className="size-5 text-teal-700" />
          Parents stay in the loop
        </h2>
        <p className="mt-2 text-pretty text-slate-700">
          Every Sunday your parent gets a short WhatsApp report: days studied, minutes, how the
          predicted score moved, and the topic that improved most. Only if they agree to receive it,
          and they can stop any time.
        </p>
      </section>

      <section aria-labelledby="pricing">
        <h2 id="pricing" className="text-2xl font-bold text-balance">
          Pricing
        </h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 p-5">
            <h3 className="font-semibold">Free</h3>
            <p className="mt-1 text-2xl font-bold tabular-nums">₦0</p>
            <ul className="mt-4 space-y-2 text-sm text-slate-700">
              <li>Subject checker</li>
              <li>Full diagnostic and predicted score</li>
              <li>20 practice questions a day (answers only)</li>
              <li>1 mock a month</li>
            </ul>
          </div>
          <div className="rounded-xl border-2 border-teal-700 p-5">
            <h3 className="font-semibold">Season Pass</h3>
            <p className="mt-1 text-2xl font-bold">
              <SeasonPrice />
            </p>
            <p className="text-sm text-slate-600">One payment, until a week after your UTME</p>
            <ul className="mt-4 space-y-2 text-sm text-slate-700">
              <li>Daily study plan built on your weak topics</li>
              <li>Unlimited practice with full explanations</li>
              <li>Mistake review that brings errors back until you master them</li>
              <li>Weekly mini-mock and full CBT mocks</li>
              <li>Weekly WhatsApp report for your parent</li>
            </ul>
          </div>
        </div>
      </section>

      <section aria-labelledby="faq">
        <h2 id="faq" className="text-2xl font-bold text-balance">
          Questions
        </h2>
        <div className="mt-4 divide-y divide-slate-200 border-y border-slate-200">
          {FAQ.map((f) => (
            <details key={f.q} className="group py-4">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 font-semibold">
                {f.q}
                <span aria-hidden="true" className="text-slate-500 group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-2 text-pretty text-slate-700">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="text-center">
        <h2 className="text-2xl font-bold text-balance">Find out where you stand today.</h2>
        <ButtonLink href="/start" size="lg" className="mt-5">
          Start free
        </ButtonLink>
      </section>
    </div>
  );
}
