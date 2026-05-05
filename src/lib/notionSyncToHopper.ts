import type { Feature, ScoringKey } from '../types';
import { SCORING_KEYS, computeScore } from '../types';

type HopperStage = 'To Feature DB' | 'Icebox';

export interface SyncToHopperPlan {
  manualCommitted: Feature[];
  manualIcebox: Feature[];
  hopperCommitted: Feature[];
  hopperIcebox: Feature[];
  reviewingSkipped: number;
  alreadyInFeatureDb: number;
}

export interface SyncToHopperResult {
  features: Feature[];
  created: number;
  committed: number;
  iceboxed: number;
  reviewingSkipped: number;
  alreadyInFeatureDb: number;
  manualSkippedNoLink: number;
  errors: string[];
}

export function planSyncToHopper(features: Feature[]): SyncToHopperPlan {
  const plan: SyncToHopperPlan = {
    manualCommitted: [],
    manualIcebox: [],
    hopperCommitted: [],
    hopperIcebox: [],
    reviewingSkipped: 0,
    alreadyInFeatureDb: 0,
  };
  for (const f of features) {
    if (f.source === 'feature') {
      plan.alreadyInFeatureDb++;
      continue;
    }
    if (f.planningStatus === null) {
      plan.reviewingSkipped++;
      continue;
    }
    if (f.source === 'hopper') {
      if (f.planningStatus === 'committed') plan.hopperCommitted.push(f);
      else plan.hopperIcebox.push(f);
    } else if (f.source === 'manual') {
      if (f.planningStatus === 'committed') plan.manualCommitted.push(f);
      else plan.manualIcebox.push(f);
    }
  }
  return plan;
}

export function describePlan(plan: SyncToHopperPlan): string {
  const manualSkipped = plan.manualCommitted.length + plan.manualIcebox.length;
  const lines = [
    `Push to Notion Hopper?`,
    ``,
    `• ${plan.hopperCommitted.length} hopper feature(s) → mark "To Feature DB"`,
    `• ${plan.hopperIcebox.length} hopper feature(s) → mark "Icebox"`,
    `• ${manualSkipped} skipped (manual — no Hopper page linked; create in Notion first)`,
    `• ${plan.reviewingSkipped} skipped (still Reviewing)`,
    `• ${plan.alreadyInFeatureDb} skipped (already in Feature DB)`,
    ``,
    `This sync only updates existing Hopper rows. It will not create anything new in Notion.`,
  ];
  return lines.join('\n');
}

function pageIdFromUrl(url: string): string {
  const slug = url.split('/').pop() ?? '';
  const trailing = slug.split('-').pop() ?? slug;
  return trailing.replace(/[^a-f0-9]/gi, '');
}

async function notionFetch<T>(path: string, body: unknown, method = 'POST'): Promise<T> {
  const res = await fetch(`/api/notion/v1${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText);
    throw new Error(`Notion API ${res.status}: ${errText.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

interface NotionPageResponse {
  id: string;
  url: string;
}

const COMMENT_LABELS: Record<ScoringKey, string> = {
  is_apart_of_company_strategy: 'Strategy',
  attached_to_company_ost: 'OST',
  minimize_churn: 'Minimize Churn',
  operationally_critical: 'Operationally Critical',
  customer_ask: 'Customer Ask',
  increase_arr: 'Increase ARR',
  competitor_parity: 'Competitor Parity',
};

interface NotionRichText {
  type: 'text';
  text: { content: string };
  annotations?: { bold?: boolean };
}

function text(content: string, bold = false): NotionRichText {
  const rt: NotionRichText = { type: 'text', text: { content } };
  if (bold) rt.annotations = { bold: true };
  return rt;
}

function buildScoringComment(f: Feature, committed: boolean): NotionRichText[] {
  const check = (b: boolean) => (b ? '✅' : '❌');
  const lines: NotionRichText[] = [text('Scoring', true)];
  for (const k of SCORING_KEYS) {
    lines.push(text(`\n${COMMENT_LABELS[k]}: ${check(f.scores[k])}`));
  }
  lines.push(text(`\nTotal Score: ${computeScore(f.scores)}`));
  lines.push(text(`\nARR: $${f.arr.toLocaleString('en-US')}`));
  lines.push(text(`\nCommitted: ${check(committed)}`));
  return lines;
}

async function postHopperComment(
  pageId: string,
  richText: NotionRichText[],
): Promise<void> {
  await notionFetch<unknown>('/comments', {
    parent: { page_id: pageId },
    rich_text: richText,
  });
}

async function patchHopperStage(
  pageId: string,
  stage: HopperStage,
): Promise<NotionPageResponse> {
  return notionFetch<NotionPageResponse>(
    `/pages/${pageId}`,
    { properties: { 'Hopper Stages': { select: { name: stage } } } },
    'PATCH',
  );
}

export async function executeSyncToHopper(
  features: Feature[],
  plan: SyncToHopperPlan,
): Promise<SyncToHopperResult> {
  const updates = new Map<string, Feature>();
  const errors: string[] = [];
  let committed = 0;
  let iceboxed = 0;

  for (const f of plan.hopperCommitted) {
    try {
      if (!f.notionUrl) throw new Error(`"${f.name}" has no notionUrl`);
      const pageId = pageIdFromUrl(f.notionUrl);
      await patchHopperStage(pageId, 'To Feature DB');
      updates.set(f.id, { ...f, source: 'feature' });
      committed++;
      try {
        await postHopperComment(pageId, buildScoringComment(f, true));
      } catch (e) {
        errors.push(`comment "${f.name}": ${(e as Error).message}`);
      }
    } catch (e) {
      errors.push(`commit "${f.name}": ${(e as Error).message}`);
    }
  }

  for (const f of plan.hopperIcebox) {
    try {
      if (!f.notionUrl) throw new Error(`"${f.name}" has no notionUrl`);
      const pageId = pageIdFromUrl(f.notionUrl);
      await patchHopperStage(pageId, 'Icebox');
      iceboxed++;
      try {
        await postHopperComment(pageId, buildScoringComment(f, false));
      } catch (e) {
        errors.push(`comment "${f.name}": ${(e as Error).message}`);
      }
    } catch (e) {
      errors.push(`icebox "${f.name}": ${(e as Error).message}`);
    }
  }

  const manualSkippedNoLink =
    plan.manualCommitted.length + plan.manualIcebox.length;

  const merged = features.map((f) => updates.get(f.id) ?? f);

  return {
    features: merged,
    created: 0,
    committed,
    iceboxed,
    reviewingSkipped: plan.reviewingSkipped,
    alreadyInFeatureDb: plan.alreadyInFeatureDb,
    manualSkippedNoLink,
    errors,
  };
}
