export type Role = 'student' | 'parent' | 'teacher' | 'admin' | 'reviewer';

export interface Me {
  id: string;
  phone: string;
  name: string | null;
  role: Role;
  state: string | null;
  examYear: number | null;
  mfaEnabled: boolean;
  profile: {
    track: 'first_timer' | 'retaker';
    lastUtmeScore: number | null;
    dailyMinutes: number | null;
    deviceType: string | null;
    targetScore: number | null;
    targetUniversity: { id: string; name: string; shortName: string | null } | null;
    targetCourse: { id: string; name: string } | null;
    onboardingDone: boolean;
  } | null;
  subjects: { code: string; name: string }[];
  parent: { phone: string; optedIn: boolean } | null;
  plan: { paid: false } | { paid: true; productCode: string; productName: string; endsAt: string };
}

export interface Subject {
  id: string;
  code: string;
  name: string;
}

export interface SubjectPrediction {
  code: string;
  answered: number;
  status: 'ready' | 'early' | 'need_more_data';
  estimate: number | null;
  halfWidth: number | null;
}

export interface Prediction {
  id: string;
  low: number;
  mid: number;
  high: number;
  status: 'ready' | 'early';
  speedFactor: number;
  perSubject: SubjectPrediction[];
  engineVersion: string;
  createdAt: string;
}

export type PlanKind =
  | 'diagnostic'
  | 'practice'
  | 'review'
  | 'mini_mock'
  | 'full_mock'
  | 'speed_drill';

export interface PlanItem {
  id: string;
  kind: PlanKind;
  title: string;
  subjectCode?: string;
  topicId?: string;
  count?: number;
  estMinutes: number;
  locked: boolean;
  completedAt?: string | null;
}

export interface TodayPlan {
  date: string;
  items: PlanItem[];
  minutesPlanned: number;
  completedAt: string | null;
}

export type MasteryLabel = 'not_started' | 'weak' | 'getting_there' | 'strong';

export interface Progress {
  streak: number;
  today: { minutes: number; questionsAnswered: number };
  week: { daysActive: number; minutes: number; questions: number };
  exam: { year: number | null; date: string | null; daysLeft: number | null };
  target: number | null;
  prediction: Prediction | null;
  gap: number | null;
  masteryMap: {
    subjectCode: string;
    topics: {
      topicId: string;
      name: string;
      weight: number;
      mastery: number;
      attempts: number;
      label: MasteryLabel;
    }[];
  }[];
}

export type OptionKey = 'A' | 'B' | 'C' | 'D';

export interface TestPayload {
  id: string;
  type: string;
  mode: 'review' | null;
  startedAt: string;
  submittedAt: string | null;
  durationSeconds: number | null;
  endsAt: string | null;
  subjects: { code: string; name: string }[];
  items: {
    position: number;
    questionId: string;
    subjectCode: string;
    stem: string;
    options: Record<OptionKey, string>;
    chosenOption: OptionKey | null;
    flagged: boolean;
    timeSpentMs: number | null;
  }[];
}

export interface TestResults {
  test: { id: string; type: string; submittedAt: string; durationSeconds: number | null };
  score: {
    correct: number;
    total: number;
    perSubject: { code: string; name: string; correct: number; total: number; scaled: number }[];
  };
  prediction: Prediction | null;
  weakestTopics: {
    topicId: string;
    name: string;
    subjectCode: string;
    correct: number;
    total: number;
    accuracy: number;
  }[];
  explanationsLocked: boolean;
  items: {
    position: number;
    questionId: string;
    subjectCode: string;
    topicName: string;
    stem: string;
    options: Record<OptionKey, string>;
    chosenOption: OptionKey | null;
    correctOption: OptionKey;
    isCorrect: boolean;
    timeSpentMs: number | null;
    explanationCorrect: string | null;
    explanationsWrong: Partial<Record<OptionKey, string>> | null;
  }[];
}

export interface Requirement {
  id: string;
  university: { id: string; name: string; shortName: string | null };
  course: { id: string; name: string };
  utmeSubjects: {
    required: { code: string; name: string }[];
    choose: { count: number; from: { code: string; name: string }[] }[];
  };
  olevelRequirements: string | null;
  notes: string | null;
  cutoffHint: string | null;
  cutoffScore: number | null;
  source: string;
  checkedAt: string;
}

export const TEST_LABELS: Record<string, string> = {
  diagnostic: 'Diagnostic test',
  short_diagnostic: 'Short diagnostic',
  mini_mock: 'Weekly mini-mock',
  full_mock: 'Full mock exam',
  practice: 'Practice',
  speed_drill: 'Speed drill',
  school_paper: 'School mock',
};
