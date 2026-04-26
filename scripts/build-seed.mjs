#!/usr/bin/env node
// Reads Notion MCP tool-result files and produces data/seed.json.
// Usage:
//   node scripts/build-seed.mjs --hopper <h.txt> --feature <f1.txt> [--feature <f2.txt> ...]
// Multiple --feature files are unioned by Notion URL (handles 100-record cap by
// querying multiple views with different sorts).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DREW_USER_ID = 'eac00464-c24f-4d39-ae97-5576db9bc9bb';
const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '..', 'data', 'seed.json');

const SCORE_KEYS = [
  'is_apart_of_company_strategy',
  'attached_to_company_ost',
  'minimize_churn',
  'operationally_critical',
  'customer_ask',
  'increase_arr',
];
const emptyScores = () =>
  Object.fromEntries(SCORE_KEYS.map((k) => [k, false]));

const loadResults = (path) => {
  const raw = readFileSync(path, 'utf8');
  const arr = JSON.parse(raw);
  const inner = JSON.parse(arr[0].text);
  return inner.results || [];
};

// Notion stores many values as stringified JSON arrays. Unwrap safely.
const parseMaybeJson = (v) => {
  if (typeof v !== 'string') return v;
  const s = v.trim();
  if (s.startsWith('[') || s.startsWith('{')) {
    try { return JSON.parse(s); } catch { return v; }
  }
  return v;
};

const toArray = (v) => {
  const p = parseMaybeJson(v);
  if (Array.isArray(p)) return p;
  if (p == null || p === '') return [];
  return [p];
};

const cleanName = (s) =>
  (s || '').replace(/\s+/g, ' ').trim() || '(untitled)';

const hopperAoR = (productArea) => {
  if (productArea === 'Profiles') return 'Profiles';
  return 'Application';
};

const featureAoR = (initiative, pillar) => {
  const inits = toArray(initiative).map(String);
  if (inits.some((i) => /profiles/i.test(i))) return 'Profiles';
  const pillars = toArray(pillar).map(String);
  if (pillars.some((p) => /profiles/i.test(p))) return 'Profiles';
  return 'Application';
};

const HOPPER_DROP_STAGES = new Set(['Icebox', 'Duplicate']);
const FEATURE_KEEP_STAGES = new Set([
  '4. Validation & Research',
  '6. Product Refinement',
  '7. Technical Refinement',
  '9. Development',
]);

const processHopper = (records) => {
  const out = [];
  for (const r of records) {
    const stage = r['Hopper Stages'];
    if (HOPPER_DROP_STAGES.has(stage)) continue;
    const pm = toArray(r['Area PM']).map(String);
    if (!pm.some((u) => u.includes(DREW_USER_ID))) continue;
    out.push({
      id: randomUUID(),
      name: cleanName(r['Idea/Topic']),
      aor: hopperAoR(r['Product Area']),
      arr: 0,
      scores: emptyScores(),
      source: 'hopper',
      notionUrl: r.url,
    });
  }
  return out;
};

// Unions multiple feature query results by Notion URL.
// Filters: PM Owner contains Drew, Pipeline Stage in FEATURE_KEEP_STAGES.
const processFeatures = (recordSets) => {
  const seen = new Map();
  for (const records of recordSets) {
    for (const r of records) {
      const pm = toArray(r['PM Owner']).map(String);
      if (!pm.some((u) => u.includes(DREW_USER_ID))) continue;
      if (!FEATURE_KEEP_STAGES.has(r['Pipeline Stage'])) continue;
      if (seen.has(r.url)) continue;
      seen.set(r.url, {
        id: randomUUID(),
        name: cleanName(r['Project Name']),
        aor: featureAoR(r['Initiative'], r['Product Pillar']),
        arr: 0,
        scores: emptyScores(),
        source: 'feature',
        notionUrl: r.url,
      });
    }
  }
  return [...seen.values()];
};

const parseArgs = (argv) => {
  const out = { hopper: null, feature: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--hopper') out.hopper = argv[++i];
    else if (a === '--feature') out.feature.push(argv[++i]);
  }
  return out;
};

const main = () => {
  const args = parseArgs(process.argv.slice(2));
  if (!args.hopper || args.feature.length === 0) {
    console.error(
      'Usage: build-seed.mjs --hopper <h.txt> --feature <f.txt> [--feature ...]',
    );
    process.exit(1);
  }
  const hopperRaw = loadResults(args.hopper);
  const featureRawSets = args.feature.map(loadResults);
  const hopper = processHopper(hopperRaw);
  const features = processFeatures(featureRawSets);
  const combined = [...features, ...hopper];

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(combined, null, 2));

  const byAor = combined.reduce((m, f) => {
    m[f.aor] = (m[f.aor] || 0) + 1;
    return m;
  }, {});
  const bySrc = combined.reduce((m, f) => {
    m[f.source] = (m[f.source] || 0) + 1;
    return m;
  }, {});
  const featureSeen = featureRawSets.reduce((s, r) => s + r.length, 0);
  console.log(`Wrote ${OUT}`);
  console.log(`Total: ${combined.length}`);
  console.log(`By source:`, bySrc);
  console.log(`By AoR:`, byAor);
  console.log(`Hopper seen: ${hopperRaw.length} (kept ${hopper.length})`);
  console.log(
    `Feature seen across ${args.feature.length} views: ${featureSeen} (kept ${features.length} unique)`,
  );
  console.log(`\nFeature DB items kept:`);
  for (const f of features) console.log(`  - ${f.name}`);
};

main();
