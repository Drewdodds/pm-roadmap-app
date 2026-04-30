import type { AoR, Feature } from '../types';
import { emptyScores } from '../types';

const DREW_USER_ID = 'eac00464-c24f-4d39-ae97-5576db9bc9bb';
const HOPPER_DROP_STAGES = ['Icebox', 'Duplicate', 'To Feature DB'] as const;
const HOPPER_DB_ID = import.meta.env.VITE_NOTION_HOPPER_DB_ID as string | undefined;

export interface HopperRow {
  notionPageId: string;
  notionUrl: string;
  name: string;
  productArea: string | null;
}

export interface MergeResult {
  merged: Feature[];
  total: number;
  added: number;
  skipped: number;
}

interface NotionQueryResponse {
  results: NotionPage[];
  has_more: boolean;
  next_cursor: string | null;
}

interface NotionPage {
  id: string;
  url: string;
  properties: Record<string, NotionProperty | undefined>;
}

interface NotionProperty {
  type: string;
  title?: Array<{ plain_text: string }>;
  select?: { name: string } | null;
  people?: Array<{ id: string }>;
  [key: string]: unknown;
}

export async function fetchHopperPages(): Promise<HopperRow[]> {
  if (!HOPPER_DB_ID) {
    throw new Error(
      'VITE_NOTION_HOPPER_DB_ID is not set. Copy .env.local.example to .env.local and restart `npm run dev`.',
    );
  }

  const filter = {
    and: [
      { property: 'Area PM', people: { contains: DREW_USER_ID } },
      ...HOPPER_DROP_STAGES.map((stage) => ({
        property: 'Hopper Stages',
        select: { does_not_equal: stage },
      })),
    ],
  };

  const all: HopperRow[] = [];
  let cursor: string | undefined;

  do {
    const body: Record<string, unknown> = { filter, page_size: 100 };
    if (cursor) body.start_cursor = cursor;

    const res = await fetch(
      `/api/notion/v1/databases/${HOPPER_DB_ID}/query`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    );

    if (!res.ok) {
      const errText = await res.text().catch(() => res.statusText);
      throw new Error(`Notion API ${res.status}: ${errText.slice(0, 200)}`);
    }

    const data = (await res.json()) as NotionQueryResponse;
    for (const page of data.results) all.push(mapPage(page));
    cursor = data.has_more && data.next_cursor ? data.next_cursor : undefined;
  } while (cursor);

  return all;
}

function mapPage(page: NotionPage): HopperRow {
  const titleProp = page.properties['Idea/Topic'];
  const name =
    titleProp?.type === 'title' && titleProp.title && titleProp.title.length > 0
      ? titleProp.title.map((t) => t.plain_text).join('')
      : '(untitled)';

  const areaProp = page.properties['Product Area'];
  const productArea =
    areaProp?.type === 'select' && areaProp.select ? areaProp.select.name : null;

  return {
    notionPageId: page.id,
    notionUrl: page.url,
    name,
    productArea,
  };
}

function guessAor(productArea: string | null): AoR {
  if (productArea && productArea.toLowerCase().includes('profiles')) {
    return 'Profiles';
  }
  return 'Application';
}

function rowToFeature(row: HopperRow): Feature {
  return {
    id: crypto.randomUUID(),
    name: row.name,
    aor: guessAor(row.productArea),
    arr: 0,
    scores: emptyScores(),
    source: 'hopper',
    notionUrl: row.notionUrl,
    needsFollowUp: false,
    planningStatus: null,
  };
}

export function mergeHopperRows(
  existing: Feature[],
  rows: HopperRow[],
): MergeResult {
  const existingUrls = new Set(
    existing.map((f) => f.notionUrl).filter((u): u is string => Boolean(u)),
  );
  const toAdd = rows.filter((r) => !existingUrls.has(r.notionUrl));
  const newFeatures = toAdd.map(rowToFeature);
  return {
    merged: [...newFeatures, ...existing],
    total: rows.length,
    added: newFeatures.length,
    skipped: rows.length - newFeatures.length,
  };
}
