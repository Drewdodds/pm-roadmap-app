import type { Feature } from './types';
import { emptyScores } from './types';

export const sampleFeatures = (): Feature[] => [
  {
    id: crypto.randomUUID(),
    name: 'Snowflake Streaming to Iceberg',
    aor: 'Application',
    arr: 450000,
    scores: {
      ...emptyScores(),
      is_apart_of_company_strategy: true,
      attached_to_company_ost: true,
      increase_arr: true,
      customer_ask: true,
    },
    source: 'feature',
    needsFollowUp: false,
    planningStatus: null,
  },
  {
    id: crypto.randomUUID(),
    name: 'Profiles Identity Graph v2',
    aor: 'Profiles',
    arr: 300000,
    scores: {
      ...emptyScores(),
      is_apart_of_company_strategy: true,
      attached_to_company_ost: true,
      minimize_churn: true,
    },
    source: 'hopper',
    needsFollowUp: false,
    planningStatus: null,
  },
  {
    id: crypto.randomUUID(),
    name: 'HubSpot upsert endpoint for Event Stream',
    aor: 'Application',
    arr: 85000,
    scores: {
      ...emptyScores(),
      customer_ask: true,
      operationally_critical: true,
    },
    source: 'hopper',
    needsFollowUp: false,
    planningStatus: null,
  },
  {
    id: crypto.randomUUID(),
    name: 'Profiles materialization performance fix',
    aor: 'Profiles',
    arr: 180000,
    scores: {
      ...emptyScores(),
      minimize_churn: true,
      operationally_critical: true,
      customer_ask: true,
    },
    source: 'feature',
    needsFollowUp: false,
    planningStatus: null,
  },
  {
    id: crypto.randomUUID(),
    name: 'Braze rate limit modification (MAU model)',
    aor: 'Application',
    arr: 120000,
    scores: {
      ...emptyScores(),
      customer_ask: true,
      increase_arr: true,
    },
    source: 'hopper',
    needsFollowUp: false,
    planningStatus: null,
  },
];
