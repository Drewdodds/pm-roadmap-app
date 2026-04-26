export type AoR = 'Application' | 'Profiles';
export type Source = 'hopper' | 'feature' | 'manual';

export const SCORING_KEYS = [
  'is_apart_of_company_strategy',
  'attached_to_company_ost',
  'minimize_churn',
  'operationally_critical',
  'customer_ask',
  'increase_arr',
  'competitor_parity',
] as const;

export type ScoringKey = (typeof SCORING_KEYS)[number];

export const SCORING_LABELS: Record<ScoringKey, string> = {
  is_apart_of_company_strategy: 'Strategy',
  attached_to_company_ost: 'OST',
  minimize_churn: 'Churn Prevention',
  operationally_critical: 'Ops Critical',
  customer_ask: 'Customer Ask',
  increase_arr: 'ARR Driver',
  competitor_parity: 'Competitor Parity',
};

export type Scores = Record<ScoringKey, boolean>;

export interface Feature {
  id: string;
  name: string;
  aor: AoR | null;
  arr: number;
  scores: Scores;
  source: Source;
  notionUrl?: string;
  needsFollowUp: boolean;
  followUpNote?: string;
}

export const emptyScores = (): Scores =>
  SCORING_KEYS.reduce((acc, k) => ({ ...acc, [k]: false }), {} as Scores);

export const computeScore = (s: Scores): number =>
  SCORING_KEYS.reduce((sum, k) => sum + (s[k] ? 1 : 0), 0);

export interface ContextItem {
  id: string;
  title: string;
  description: string;
}

export type ContextKind = 'strategies' | 'osts';
