import {
  ArrowRight,
  CalendarCheck,
  Check,
  MessageCircle,
  MonitorSmartphone,
  ShieldCheck,
  Target,
  WifiOff,
} from 'lucide-react';
import { ScoreRing } from '@/components/score-ring';
import { SeasonPrice } from '@/components/season-price';
import { Track } from '@/components/track';
import { ButtonLink } from '@/components/ui/button';

// F-ACQ-04. Server-rendered; readable without JavaScript.
// Copy rules (spec §21): no testimonials, no invented statistics, no guarantees.

const FAQ = [
  ['Is this JAMB?', 'No. ScoreCoach is an independent study service, not affiliated with JAMB.'],
  [
    'How accurate is the predicted score?',
    'It’s a range from your own answers. It starts wide and narrows as you practise. Never a promise.',
  ],
  [
    'Does it work with bad network?',
    'Yes. Answers save on your phone and sync when you’re back online.',
  ],
  [
    'Can my parent pay?',
    'Yes — send them a link on WhatsApp. Card, transfer or USSD, no account needed.',
  ],
  [
    'What if I change phones?',
    'Your plan follows your phone number. Sign in on the new phone and carry on.',
  ],
];

function Section({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`mx-auto max-w-5xl px-4 ${className}`}>{children}</section>;
}

export default function Home() {
  return (
    <div className="overflow-hidden">
      <Track name="landing_viewed" />

      {/* Hero */}
      <div className="relative">
        <div aria-hidden="true" className="bg-glow pointer-events-none absolute inset-0" />
        <div aria-hidden="true" className="bg-grid pointer-events-none absolute inset-0" />
        <Section className="relative grid items-center gap-12 pt-14 pb-20 sm:pt-20 lg:grid-cols-[1.1fr_1fr] lg:pb-28">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-line-strong bg-white/[0.04] px-3 py-1 text-xs font-medium text-fg-2">
              <span className="size-1.5 rounded-full bg-accent" /> UTME 2027 · Free diagnostic
            </p>
            <h1 className="text-gradient mt-6 text-5xl font-semibold text-balance sm:text-6xl">
              Get the score your course needs.
            </h1>
            <p className="mt-5 max-w-md text-lg text-pretty text-muted">
              See your likely JAMB score today. Then study exactly what closes the gap.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href="/start" size="lg">
                Start free <ArrowRight aria-hidden="true" className="size-4" />
              </ButtonLink>
              <ButtonLink href="/checker" size="lg" variant="secondary">
                Check my subjects
              </ButtonLink>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
              {[
                [MonitorSmartphone, 'Real CBT practice'],
                [WifiOff, 'Works offline'],
                [ShieldCheck, 'No password'],
              ].map(([Icon, t]) => {
                const I = Icon as typeof WifiOff;
                return (
                  <li key={t as string} className="flex items-center gap-1.5">
                    <I aria-hidden="true" className="size-4 text-accent" />
                    {t as string}
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Product preview (example data) */}
          <div className="relative mx-auto w-full max-w-sm">
            <div
              aria-hidden="true"
              className="absolute -inset-6 rounded-[2.5rem] bg-emerald-500/10 blur-2xl"
            />
            <figure className="glass relative rounded-[2rem] border border-line-strong p-6 shadow-2xl">
              <figcaption className="flex items-center justify-between text-xs text-muted">
                <span>Example</span>
                <span className="rounded-full bg-white/[0.06] px-2 py-0.5">Medicine · UNILAG</span>
              </figcaption>
              <ScoreRing
                low={198}
                mid={214}
                high={230}
                target={260}
                size={220}
                className="mx-auto mt-2"
              />
              <div className="mt-2 grid grid-cols-2 gap-2 text-center">
                <div className="rounded-xl bg-white/[0.04] p-3">
                  <p className="text-xl font-semibold tabular-nums">+46</p>
                  <p className="text-xs text-muted">to target</p>
                </div>
                <div className="rounded-xl bg-white/[0.04] p-3">
                  <p className="text-xl font-semibold tabular-nums">35 min</p>
                  <p className="text-xs text-muted">today’s plan</p>
                </div>
              </div>
              <ul className="mt-3 space-y-2 text-sm">
                {['Physics · Motion', 'Maths · Algebra', 'Review 8 mistakes'].map((t, i) => (
                  <li
                    key={t}
                    className="flex items-center gap-3 rounded-xl border border-line px-3 py-2.5"
                  >
                    <span
                      className={`grid size-5 place-items-center rounded-full ${i === 0 ? 'bg-accent text-on-accent' : 'border border-line-strong'}`}
                    >
                      {i === 0 && <Check aria-hidden="true" className="size-3" />}
                    </span>
                    <span className={i === 0 ? 'text-muted line-through' : ''}>{t}</span>
                  </li>
                ))}
              </ul>
            </figure>
          </div>
        </Section>
      </div>

      {/* Bento */}
      <Section className="pb-24">
        <h2 className="text-3xl font-semibold text-balance sm:text-4xl">
          Less guessing. More marks.
        </h2>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          <article className="glass rounded-3xl border border-line p-6 md:col-span-2">
            <Target aria-hidden="true" className="size-6 text-accent" />
            <h3 className="mt-4 text-lg font-semibold">Your gap, in marks</h3>
            <p className="mt-1 text-muted">
              Pick your course. We show how far you are, subject by subject.
            </p>
            <div className="mt-6 space-y-3">
              {[
                ['English', 62],
                ['Physics', 48],
                ['Chemistry', 55],
                ['Biology', 71],
              ].map(([s, v]) => (
                <div
                  key={s as string}
                  className="grid grid-cols-[5.5rem_1fr_2.5rem] items-center gap-3 text-sm"
                >
                  <span className="text-fg-2">{s}</span>
                  <span className="h-2 rounded-full bg-white/[0.06]">
                    <span
                      className="block h-2 rounded-full bg-gradient-to-r from-emerald-600 to-emerald-300"
                      style={{ width: `${v}%` }}
                    />
                  </span>
                  <span className="text-right text-muted tabular-nums">{v}</span>
                </div>
              ))}
            </div>
          </article>
          <article className="glass rounded-3xl border border-line p-6">
            <CalendarCheck aria-hidden="true" className="size-6 text-accent" />
            <h3 className="mt-4 text-lg font-semibold">A plan for today</h3>
            <p className="mt-1 text-muted">20–90 minutes. Weakest high-value topics first.</p>
            <p className="mt-6 text-5xl font-semibold tabular-nums">1·3·7·14</p>
            <p className="text-sm text-muted">days — when mistakes come back</p>
          </article>
          <article className="glass rounded-3xl border border-line p-6">
            <MonitorSmartphone aria-hidden="true" className="size-6 text-accent" />
            <h3 className="mt-4 text-lg font-semibold">Feels like the real CBT</h3>
            <p className="mt-1 text-muted">Timer, navigator, keyboard shortcuts.</p>
            <ol aria-hidden="true" className="mt-6 grid grid-cols-6 gap-1.5">
              {Array.from({ length: 18 }, (_, i) => (
                <li
                  key={i}
                  className={`grid h-7 place-items-center rounded-md text-[11px] tabular-nums ${i < 11 ? 'bg-accent text-on-accent' : i === 11 ? 'ring-2 ring-fg' : 'border border-line-strong text-muted'}`}
                >
                  {i + 1}
                </li>
              ))}
            </ol>
          </article>
          <article className="glass rounded-3xl border border-line p-6 md:col-span-2">
            <MessageCircle aria-hidden="true" className="size-6 text-accent" />
            <h3 className="mt-4 text-lg font-semibold">Parents stay in the loop</h3>
            <p className="mt-1 text-muted">
              One WhatsApp message every Sunday. Only if they agree.
            </p>
            <div className="mt-6 max-w-md rounded-2xl rounded-tl-sm bg-[#0b3d2e] p-4 text-sm text-emerald-50">
              Tolu studied <b>5 of 7 days</b> (3h 40m). Predicted score <b>192 → 205</b>. Biggest
              improvement: Physics – Motion.
              <span className="mt-1 block text-right text-[11px] text-emerald-200/60">
                Sun 6:00 pm
              </span>
            </div>
          </article>
        </div>
      </Section>

      {/* Steps */}
      <Section className="pb-24">
        <ol className="grid gap-4 sm:grid-cols-3">
          {[
            ['Check subjects', 'Make sure your four fit your course.'],
            ['Take the diagnostic', 'CBT-style. Get your score range.'],
            ['Follow the plan', 'A little every day. Weekly mock.'],
          ].map(([t, d], i) => (
            <li key={t} className="rounded-3xl border border-line p-6">
              <span className="font-mono text-sm text-accent">0{i + 1}</span>
              <h3 className="mt-3 font-semibold">{t}</h3>
              <p className="mt-1 text-sm text-muted">{d}</p>
            </li>
          ))}
        </ol>
      </Section>

      {/* Pricing */}
      <Section className="pb-24">
        <h2 className="text-3xl font-semibold text-balance sm:text-4xl">Simple pricing</h2>
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          <div className="rounded-3xl border border-line p-7">
            <h3 className="font-semibold">Free</h3>
            <p className="mt-2 text-4xl font-semibold tabular-nums">₦0</p>
            <ul className="mt-6 space-y-3 text-sm text-fg-2">
              {[
                'Subject checker',
                'Diagnostic + predicted score',
                '20 questions a day',
                '1 mock a month',
              ].map((f) => (
                <li key={f} className="flex gap-2">
                  <Check aria-hidden="true" className="size-4 text-muted" /> {f}
                </li>
              ))}
            </ul>
          </div>
          <div className="glass relative rounded-3xl border border-emerald-400/30 p-7">
            <div
              aria-hidden="true"
              className="absolute inset-x-10 -top-px h-px bg-gradient-to-r from-transparent via-emerald-300 to-transparent"
            />
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Season Pass</h3>
              <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-emerald-300">
                Until your exam
              </span>
            </div>
            <p className="mt-2 text-4xl font-semibold">
              <SeasonPrice fallback="—" />
            </p>
            <ul className="mt-6 space-y-3 text-sm text-fg-2">
              {[
                'Daily plan on your weak topics',
                'Unlimited practice + explanations',
                'Mistake review',
                'Weekly + full CBT mocks',
                'Weekly parent report',
              ].map((f) => (
                <li key={f} className="flex gap-2">
                  <Check aria-hidden="true" className="size-4 text-accent" /> {f}
                </li>
              ))}
            </ul>
            <ButtonLink href="/start" block className="mt-7">
              Start free
            </ButtonLink>
          </div>
        </div>
      </Section>

      {/* FAQ */}
      <Section className="pb-24">
        <h2 className="text-3xl font-semibold text-balance">Questions</h2>
        <div className="mt-8 divide-y divide-line border-y border-line">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group py-5">
              <summary className="flex min-h-8 cursor-pointer list-none items-center justify-between gap-4 font-medium">
                {q}
                <span aria-hidden="true" className="text-xl text-muted group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-2 text-pretty text-muted">{a}</p>
            </details>
          ))}
        </div>
      </Section>

      {/* CTA */}
      <Section className="pb-24">
        <div className="relative overflow-hidden rounded-3xl border border-line px-6 py-14 text-center">
          <div aria-hidden="true" className="bg-glow absolute inset-0" />
          <h2 className="text-gradient relative text-3xl font-semibold text-balance sm:text-4xl">
            Find out where you stand.
          </h2>
          <ButtonLink href="/start" size="lg" className="relative mt-8">
            Take the free diagnostic <ArrowRight aria-hidden="true" className="size-4" />
          </ButtonLink>
        </div>
      </Section>
    </div>
  );
}
