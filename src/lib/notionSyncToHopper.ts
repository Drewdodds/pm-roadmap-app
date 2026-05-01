import type { Feature } from '../types';
import { DREW_USER_ID } from './notionSync';

const HOPPER_DB_ID = import.meta.env.VITE_NOTION_HOPPER_DB_ID as string | undefined;

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
  const lines = [
    `Push to Notion Hopper?`,
    ``,
    `• ${plan.manualCommitted.length} manual feature(s) → create Hopper rows (To Feature DB)`,
    `• ${plan.manualIcebox.length} manual feature(s) → create Hopper rows (Icebox)`,
    `• ${plan.hopperCommitted.length} hopper feature(s) → mark "To Feature DB"`,
    `• ${plan.hopperIcebox.length} hopper feature(s) → mark "Icebox"`,
    `• ${plan.reviewingSkipped} skipped (still Reviewing)`,
    `• ${plan.alreadyInFeatureDb} skipped (already in Feature DB)`,
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

async function createHopperPage(
  name: string,
  stage: HopperStage,
): Promise<NotionPageResponse> {
  if (!HOPPER_DB_ID) throw new Error('VITE_NOTION_HOPPER_DB_ID is not set.');
  return notionFetch<NotionPageResponse>('/pages', {
    parent: { database_id: HOPPER_DB_ID },
    properties: {
      'Idea/Topic': { title: [{ text: { content: name } }] },
      'Hopper Stages': { select: { name: stage } },
      'Area PM': { people: [{ id: DREW_USER_ID }] },
    },
  });
}

export async function executeSyncToHopper(
  features: Feature[],
  plan: SyncToHopperPlan,
): Promise<SyncToHopperResult> {
  const updates = new Map<string, Feature>();
  const errors: string[] = [];
  let created = 0;
  let committed = 0;
  let iceboxed = 0;

  for (const f of plan.hopperCommitted) {
    try {
      if (!f.notionUrl) throw new Error(`"${f.name}" has no notionUrl`);
      await patchHopperStage(pageIdFromUrl(f.notionUrl), 'To Feature DB');
      updates.set(f.id, { ...f, source: 'feature' });
      committed++;
    } catch (e) {
      errors.push(`commit "${f.name}": ${(e as Error).message}`);
    }
  }

  for (const f of plan.hopperIcebox) {
    try {
      if (!f.notionUrl) throw new Error(`"${f.name}" has no notionUrl`);
      await patchHopperStage(pageIdFromUrl(f.notionUrl), 'Icebox');
      iceboxed++;
    } catch (e) {
      errors.push(`icebox "${f.name}": ${(e as Error).message}`);
    }
  }

  for (const f of plan.manualCommitted) {
    try {
      const hopperPage = await createHopperPage(f.name, 'To Feature DB');
      updates.set(f.id, {
        ...f,
        source: 'feature',
        notionUrl: hopperPage.url,
      });
      created++;
      committed++;
    } catch (e) {
      errors.push(`create+commit "${f.name}": ${(e as Error).message}`);
    }
  }

  for (const f of plan.manualIcebox) {
    try {
      const hopperPage = await createHopperPage(f.name, 'Icebox');
      updates.set(f.id, {
        ...f,
        source: 'hopper',
        notionUrl: hopperPage.url,
      });
      created++;
      iceboxed++;
    } catch (e) {
      errors.push(`create+icebox "${f.name}": ${(e as Error).message}`);
    }
  }

  const merged = features.map((f) => updates.get(f.id) ?? f);

  return {
    features: merged,
    created,
    committed,
    iceboxed,
    reviewingSkipped: plan.reviewingSkipped,
    alreadyInFeatureDb: plan.alreadyInFeatureDb,
    errors,
  };
}
