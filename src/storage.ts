import type { ContextItem, ContextKind, Feature } from './types';
import { emptyScores } from './types';

const KEY = 'pm-roadmap-app:features:v1';
const CONTEXT_KEYS: Record<ContextKind, string> = {
  strategies: 'pm-roadmap-app:strategies:v1',
  osts: 'pm-roadmap-app:osts:v1',
};

export const loadContextItems = (kind: ContextKind): ContextItem[] => {
  try {
    const raw = localStorage.getItem(CONTEXT_KEYS[kind]);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Partial<ContextItem>[];
    return parsed.map((i) => ({
      id: i.id ?? crypto.randomUUID(),
      title: i.title ?? '',
      description: i.description ?? '',
    }));
  } catch {
    return [];
  }
};

export const saveContextItems = (
  kind: ContextKind,
  items: ContextItem[],
): void => {
  localStorage.setItem(CONTEXT_KEYS[kind], JSON.stringify(items));
};

export const loadFeatures = (): Feature[] => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Feature[];
    return parsed.map(normalize);
  } catch {
    return [];
  }
};

export const saveFeatures = (features: Feature[]): void => {
  localStorage.setItem(KEY, JSON.stringify(features));
};

const normalize = (f: Partial<Feature>): Feature => ({
  id: f.id ?? crypto.randomUUID(),
  name: f.name ?? 'Untitled',
  aor: (f.aor as Feature['aor']) ?? null,
  arr: typeof f.arr === 'number' ? f.arr : 0,
  scores: { ...emptyScores(), ...(f.scores ?? {}) },
  source: (f.source as Feature['source']) ?? 'manual',
  notionUrl: f.notionUrl,
  needsFollowUp: f.needsFollowUp ?? false,
  followUpNote: f.followUpNote,
});

export const exportJSON = (features: Feature[]): void => {
  const blob = new Blob([JSON.stringify(features, null, 2)], {
    type: 'application/json',
  });
  downloadBlob(blob, `pm-roadmap-${timestamp()}.json`);
};

export const exportCSV = (features: Feature[]): void => {
  const headers = [
    'id',
    'name',
    'aor',
    'arr',
    'score',
    'is_apart_of_company_strategy',
    'attached_to_company_ost',
    'minimize_churn',
    'operationally_critical',
    'customer_ask',
    'increase_arr',
    'source',
    'notionUrl',
    'needsFollowUp',
    'followUpNote',
  ];
  const rows = features.map((f) => [
    f.id,
    csvCell(f.name),
    f.aor ?? '',
    String(f.arr),
    String(
      Object.values(f.scores).filter(Boolean).length,
    ),
    ...Object.values(f.scores).map((v) => (v ? '1' : '0')),
    f.source,
    f.notionUrl ?? '',
    f.needsFollowUp ? '1' : '0',
    csvCell(f.followUpNote ?? ''),
  ]);
  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  downloadBlob(blob, `pm-roadmap-${timestamp()}.csv`);
};

export const importJSON = async (file: File): Promise<Feature[]> => {
  const text = await file.text();
  const parsed = JSON.parse(text) as Partial<Feature>[];
  return parsed.map(normalize);
};

const csvCell = (v: string): string => {
  if (v.includes(',') || v.includes('"') || v.includes('\n')) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
};

const timestamp = (): string =>
  new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');

const downloadBlob = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
