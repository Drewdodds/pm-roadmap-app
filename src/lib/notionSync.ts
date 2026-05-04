import type { AoR, Customer, Feature } from '../types';
import { emptyScores } from '../types';
import { normalizeNotionId } from '../storage';

export const DREW_USER_ID = 'eac00464-c24f-4d39-ae97-5576db9bc9bb';
const HOPPER_DROP_STAGES = ['Icebox', 'Duplicate', 'To Feature DB'] as const;
const HOPPER_DB_ID = import.meta.env.VITE_NOTION_HOPPER_DB_ID as string | undefined;
const CUSTOMER_DB_ID = import.meta.env.VITE_NOTION_CUSTOMER_DB_ID as string | undefined;

export interface HopperRow {
  notionPageId: string;
  notionUrl: string;
  name: string;
  productArea: string | null;
  customerIds: string[];
}

export interface HopperMergeResult {
  merged: Feature[];
  total: number;
  added: number;
  updated: number;
}

export interface CustomerMergeResult {
  merged: Customer[];
  added: number;
  updated: number;
}

export interface SyncResult {
  features: Feature[];
  customers: Customer[];
  total: number;
  added: number;
  updated: number;
  customersAdded: number;
  customersUpdated: number;
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
  rich_text?: Array<{ plain_text: string }>;
  select?: { name: string } | null;
  number?: number | null;
  people?: Array<{ id: string }>;
  relation?: Array<{ id: string }>;
  [key: string]: unknown;
}

async function queryNotionDb(
  dbId: string,
  body: Record<string, unknown>,
): Promise<NotionPage[]> {
  const all: NotionPage[] = [];
  let cursor: string | undefined;
  do {
    const reqBody: Record<string, unknown> = { ...body, page_size: 100 };
    if (cursor) reqBody.start_cursor = cursor;
    const res = await fetch(`/api/notion/v1/databases/${dbId}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reqBody),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => res.statusText);
      throw new Error(`Notion API ${res.status}: ${errText.slice(0, 200)}`);
    }
    const data = (await res.json()) as NotionQueryResponse;
    all.push(...data.results);
    cursor = data.has_more && data.next_cursor ? data.next_cursor : undefined;
  } while (cursor);
  return all;
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
  const pages = await queryNotionDb(HOPPER_DB_ID, { filter });
  return pages.map(mapHopperPage);
}

export async function fetchCustomers(): Promise<Customer[]> {
  if (!CUSTOMER_DB_ID) {
    throw new Error(
      'VITE_NOTION_CUSTOMER_DB_ID is not set. Copy .env.local.example to .env.local and restart `npm run dev`.',
    );
  }
  const pages = await queryNotionDb(CUSTOMER_DB_ID, {});
  return pages.map(mapCustomerPage);
}

function mapHopperPage(page: NotionPage): HopperRow {
  const titleProp = page.properties['Idea/Topic'];
  const name =
    titleProp?.type === 'title' && titleProp.title && titleProp.title.length > 0
      ? titleProp.title.map((t) => t.plain_text).join('')
      : '(untitled)';

  const areaProp = page.properties['Product Area'];
  const productArea =
    areaProp?.type === 'select' && areaProp.select ? areaProp.select.name : null;

  const customerProp = page.properties['Customer Organization'];
  const customerIds =
    customerProp?.type === 'relation' && Array.isArray(customerProp.relation)
      ? customerProp.relation.map((r) => normalizeNotionId(r.id))
      : [];

  return {
    notionPageId: page.id,
    notionUrl: page.url,
    name,
    productArea,
    customerIds,
  };
}

function mapCustomerPage(page: NotionPage): Customer {
  const nameProp = page.properties['Name'];
  const name =
    nameProp?.type === 'title' && nameProp.title && nameProp.title.length > 0
      ? nameProp.title.map((t) => t.plain_text).join('')
      : '(unnamed)';

  const arrProp = page.properties['ARR'];
  const arr =
    arrProp?.type === 'number' && typeof arrProp.number === 'number'
      ? arrProp.number
      : 0;

  const orgIdProp = page.properties['ORG_ID'];
  const orgId =
    orgIdProp?.type === 'rich_text' && orgIdProp.rich_text
      ? orgIdProp.rich_text.map((t) => t.plain_text).join('')
      : '';

  const planProp = page.properties['PLAN_TYPE'];
  const planType =
    planProp?.type === 'select' && planProp.select ? planProp.select.name : '';

  return {
    id: normalizeNotionId(page.id),
    notionUrl: page.url,
    name,
    arr,
    orgId,
    planType,
  };
}

function guessAor(productArea: string | null): AoR {
  if (productArea && productArea.toLowerCase().includes('profiles')) {
    return 'Profiles';
  }
  return 'Application';
}

export function mergeCustomers(
  existing: Customer[],
  fetched: Customer[],
): CustomerMergeResult {
  const byId = new Map(existing.map((c) => [c.id, c] as const));
  let added = 0;
  let updated = 0;
  for (const c of fetched) {
    if (byId.has(c.id)) {
      updated++;
    } else {
      added++;
    }
    byId.set(c.id, c);
  }
  return { merged: Array.from(byId.values()), added, updated };
}

const pageIdFromUrl = (url: string): string => {
  const slug = url.split('/').pop() ?? '';
  const trailing = slug.split('-').pop() ?? slug;
  return trailing.replace(/[^a-f0-9]/gi, '').toLowerCase();
};

export function mergeHopperRows(
  existing: Feature[],
  rows: HopperRow[],
  customers: Customer[],
): HopperMergeResult {
  const customerById = new Map(customers.map((c) => [c.id, c] as const));
  const aggregateArr = (ids: string[]): number =>
    ids.reduce((sum, id) => sum + (customerById.get(id)?.arr ?? 0), 0);

  const byPageId = new Map(
    existing
      .filter((f): f is Feature & { notionUrl: string } => Boolean(f.notionUrl))
      .map((f) => [pageIdFromUrl(f.notionUrl), f] as const),
  );

  let added = 0;
  let updated = 0;
  const newFeatures: Feature[] = [];
  const updatedById = new Map<string, Feature>();

  for (const row of rows) {
    const aggArr = aggregateArr(row.customerIds);
    const existingFeature = byPageId.get(pageIdFromUrl(row.notionUrl));
    if (existingFeature) {
      updatedById.set(existingFeature.id, {
        ...existingFeature,
        notionUrl: row.notionUrl,
        arr: aggArr,
        scores: { ...existingFeature.scores, customer_ask: row.customerIds.length > 0 },
        customerIds: row.customerIds,
      });
      updated++;
    } else {
      newFeatures.push({
        id: crypto.randomUUID(),
        name: row.name,
        aor: guessAor(row.productArea),
        arr: aggArr,
        scores: { ...emptyScores(), customer_ask: row.customerIds.length > 0 },
        source: 'hopper',
        notionUrl: row.notionUrl,
        needsFollowUp: false,
        planningStatus: null,
        customerIds: row.customerIds,
      });
      added++;
    }
  }

  const merged = [
    ...newFeatures,
    ...existing.map((f) => updatedById.get(f.id) ?? f),
  ];

  return { merged, total: rows.length, added, updated };
}

export async function syncFromHopper(
  features: Feature[],
  customers: Customer[],
): Promise<SyncResult> {
  const fetchedCustomers = await fetchCustomers();
  const customerMerge = mergeCustomers(customers, fetchedCustomers);
  const rows = await fetchHopperPages();
  const featureMerge = mergeHopperRows(features, rows, customerMerge.merged);
  return {
    features: featureMerge.merged,
    customers: customerMerge.merged,
    total: featureMerge.total,
    added: featureMerge.added,
    updated: featureMerge.updated,
    customersAdded: customerMerge.added,
    customersUpdated: customerMerge.updated,
  };
}
