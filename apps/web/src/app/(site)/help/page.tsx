import type { Metadata } from 'next';
import { Prose } from '@/components/prose';
import { Alert } from '@/components/ui/alert';

export const metadata: Metadata = {
  title: 'Help centre',
  description: 'Answers to common questions, the JAMB exam-day kit and registration guide.',
};

const FAQ: [string, string][] = [
  [
    'I didn’t get my sign-in code',
    'Wait 60 seconds and tap “Resend code”. Check the number starts with 070, 080, 081, 090 or 091. If you still get nothing, message us on WhatsApp — some networks delay SMS at busy times.',
  ],
  [
    'I paid but my plan isn’t active',
    'Most payments confirm within a minute. If yours hasn’t after 15 minutes, use “Report a problem” → “I paid but my plan isn’t active” with your bank alert. We fix these first, usually within 15 minutes during support hours.',
  ],
  [
    'I changed phones',
    'Sign in on the new phone with the same number. Your plan, progress and mistakes are all there. If you hit the 2-device limit, pick the old phone to sign out.',
  ],
  [
    'How is the predicted score worked out?',
    'We look at every question you’ve answered, weight topics by how often they appear in JAMB, give recent answers more weight, adjust for question difficulty, and check whether you’re fast enough. We show a range, and it narrows as you answer more. It’s an estimate, never a promise.',
  ],
  [
    'Why are some explanations locked?',
    'Free accounts see the correct answer. Step-by-step explanations of why each option is right or wrong come with the Season Pass.',
  ],
  [
    'I found a wrong answer',
    'Tap “Report a problem with this question” under it. A subject teacher checks every report. If you’re right, we add extra days to your plan.',
  ],
  [
    'How do I stop my parent’s reports?',
    'Your parent can reply STOP or use the link in their message. You can also message support.',
  ],
];

export default function HelpPage() {
  return (
    <Prose>
      <h1 className="text-3xl font-bold text-balance">Help centre</h1>
      <h2>Common questions</h2>
      {FAQ.map(([q, a]) => (
        <details key={q} className="rounded-lg border border-slate-200 p-3">
          <summary className="min-h-8 cursor-pointer font-semibold">{q}</summary>
          <p className="mt-2">{a}</p>
        </details>
      ))}

      <h2 id="exam-day">Exam-day survival kit</h2>
      <Alert tone="warning">
        Always confirm details on your JAMB slip and at jamb.gov.ng. Rules can change each year.
        [VERIFY yearly]
      </Alert>
      <h3>The day before</h3>
      <ul>
        <li>Print your exam slip. Check your centre address, date and time.</li>
        <li>Visit the centre if you can, so you know how long the journey takes.</li>
        <li>Sleep early. Don’t cram new topics — review your mistake list.</li>
      </ul>
      <h3>What to take</h3>
      <ul>
        <li>Your printed exam slip.</li>
        <li>
          Only what your slip allows. Leave phones, smart watches and calculators at home or as
          instructed.
        </li>
      </ul>
      <h3>At the centre</h3>
      <ul>
        <li>Arrive early — at least the time on your slip, earlier if you can.</li>
        <li>Follow the officials’ instructions for biometric verification.</li>
      </ul>
      <h3>If something goes wrong</h3>
      <ul>
        <li>
          <strong>Your computer freezes or logs you out:</strong> stay calm and raise your hand
          immediately. Don’t try to fix it yourself. Your answers are normally saved on the server.
        </li>
        <li>
          <strong>The exam starts late:</strong> stay at the centre and follow instructions. Use the
          time to breathe slowly, not to panic-revise.
        </li>
        <li>
          <strong>You miss the exam because of a technical problem at the centre:</strong> JAMB
          usually announces rescheduling for affected candidates. Watch jamb.gov.ng and our verified
          updates — ignore unofficial messages.
        </li>
      </ul>
      <h3>Calm-down routine (60 seconds)</h3>
      <ol>
        <li>Breathe in for 4 counts, hold for 4, out for 6. Repeat three times.</li>
        <li>Skip any question that takes more than a minute. Flag it and come back.</li>
        <li>Answer everything — a blank scores zero.</li>
      </ol>

      <h2 id="registration">Registration checklist</h2>
      <Alert tone="warning">
        Fees, dates and steps below are general guidance. Check the current JAMB brochure and
        announcements. [VERIFY yearly]
      </Alert>
      <ul>
        <li>
          Get your profile code by SMS from the number JAMB publishes for the year (use the SIM
          you’ll keep).
        </li>
        <li>Buy the e-PIN only from JAMB-approved channels. Keep the receipt.</li>
        <li>
          Register at an accredited CBT centre. Confirm your four subjects match your course with
          our subject checker first.
        </li>
        <li>
          Check your name, date of birth and subjects carefully before you leave. Ask for a
          printout.
        </li>
        <li>
          Never pay more than the official fee plus any service charge JAMB allows. Report
          overcharging.
        </li>
      </ul>
      <p>ScoreCoach is not affiliated with JAMB.</p>
    </Prose>
  );
}
