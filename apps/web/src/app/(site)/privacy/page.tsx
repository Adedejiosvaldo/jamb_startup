import type { Metadata } from 'next';
import { Prose } from '@/components/prose';
import { Alert } from '@/components/ui/alert';

export const metadata: Metadata = { title: 'Privacy' };

export default function PrivacyPage() {
  return (
    <Prose>
      <h1 className="text-3xl font-bold">Privacy</h1>
      <Alert tone="warning">
        Draft for legal review under the Nigeria Data Protection Act 2023. [VERIFY with counsel
        before launch]
      </Alert>
      <p>
        <strong>In short:</strong> we collect only what we need to help you study, we never sell
        your data, and we don’t use advertising trackers.
      </p>
      <h2>What we collect</h2>
      <ul>
        <li>Your phone number (to sign you in) and name.</li>
        <li>Your exam year, target course and subjects.</li>
        <li>Your answers, study time and scores, to build your plan and predicted score.</li>
        <li>
          Your parent’s phone number only if you add it, and reports go to them only after they
          agree.
        </li>
        <li>Payment records from Paystack. We never see or store card details.</li>
      </ul>
      <p>We don’t track your location, read your contacts or use your camera.</p>
      <h2>How we use it</h2>
      <ul>
        <li>To run your study plan, predictions and mocks.</li>
        <li>To send sign-in codes, receipts, and — with consent — weekly parent reports.</li>
        <li>
          To fix problems and improve questions (for example, which questions are often reported as
          wrong).
        </li>
      </ul>
      <h2>Students under 18</h2>
      <p>
        Most of our students are under 18. We keep their data to the minimum, show no public
        profiles, allow no chat between users, and show only first name and initial to lesson
        teachers they choose to join.
      </p>
      <h2>Your rights</h2>
      <p>
        You can ask to see, correct, export or delete your data at any time from Account → “Delete
        my account and data”, or by messaging support. We complete deletion within 30 days. We keep
        payment records for as long as the law requires. Learning data of inactive accounts is
        deleted after 24 months.
      </p>
      <h2>Pidgin summary</h2>
      <p>
        We no dey sell your data. We only keep wetin we need to help you read for JAMB. You fit ask
        us to delete am anytime.
      </p>
    </Prose>
  );
}
