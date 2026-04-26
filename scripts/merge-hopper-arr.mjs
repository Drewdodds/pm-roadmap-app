#!/usr/bin/env node
// Merges a Hopper ARR CSV into data/seed.json.
// CSV is expected to contain at minimum columns named:
//   - feature      (Hopper title — matches seed.json `name` for source=hopper)
//   - total_arr    (numeric; accepts commas, $, decimals)
// Optional columns (parent_feature, hopper_stage, etc.) are ignored.
//
// Usage:
//   node scripts/merge-hopper-arr.mjs data/feature_arr_output.csv
//
// Matching:
//   - Exact match on normalized name (lowercased, whitespace collapsed,
//     trailing punctuation stripped).
//   - Reports matched / unmatched counts and lists CSV rows that didn't match
//     a seed entry so you can see whether it's a rename or a record not in
//     the current seed.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SEED = resolve(__dirname, '..', 'data', 'seed.json');

const normalize = (s) =>
  (s || '')
    .toLowerCase()
    .replace(/[\s\u00A0]+/g, ' ')
    .replace(/[.,;:!?]+$/g, '')
    .trim();

const parseArr = (v) => {
  if (v == null) return 0;
  const s = String(v).replace(/[$,\s]/g, '').trim();
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n) : 0;
};

// Minimal CSV parser: handles quoted fields containing commas.
const parseCSV = (text) => {
  const rows = [];
  let i = 0;
  const n = text.length;
  while (i < n) {
    const row = [];
    let field = '';
    let inQuotes = false;
    while (i < n) {
      const c = text[i];
      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') {
            field += '"';
            i += 2;
          } else {
            inQuotes = false;
            i++;
          }
        } else {
          field += c;
          i++;
        }
      } else {
        if (c === '"') {
          inQuotes = true;
          i++;
        } else if (c === ',') {
          row.push(field);
          field = '';
          i++;
        } else if (c === '\n' || c === '\r') {
          break;
        } else {
          field += c;
          i++;
        }
      }
    }
    row.push(field);
    rows.push(row);
    // consume line break(s)
    while (i < n && (text[i] === '\n' || text[i] === '\r')) i++;
  }
  return rows;
};

const main = () => {
  const csvPath = process.argv[2];
  if (!csvPath) {
    console.error('Usage: merge-hopper-arr.mjs <csv-path>');
    process.exit(1);
  }
  const raw = readFileSync(resolve(csvPath), 'utf8');
  const rows = parseCSV(raw).filter((r) => r.some((c) => c !== ''));
  const [header, ...body] = rows;
  const featureIdx = header.findIndex(
    (h) => h.toLowerCase() === 'feature',
  );
  const arrIdx = header.findIndex(
    (h) => h.toLowerCase() === 'total_arr',
  );
  if (featureIdx === -1 || arrIdx === -1) {
    console.error(
      `CSV must have columns "feature" and "total_arr". Got: ${header.join(', ')}`,
    );
    process.exit(1);
  }

  const seed = JSON.parse(readFileSync(SEED, 'utf8'));

  // Build normalized-name -> seed row index for hopper rows
  const byName = new Map();
  seed.forEach((row, i) => {
    if (row.source === 'hopper') {
      const key = normalize(row.name);
      if (!byName.has(key)) byName.set(key, []);
      byName.get(key).push(i);
    }
  });

  let matched = 0;
  let skippedZero = 0;
  const unmatched = [];
  const updates = []; // [name, oldArr, newArr]

  for (const row of body) {
    const name = row[featureIdx];
    const arr = parseArr(row[arrIdx]);
    if (!name) continue;
    const key = normalize(name);
    const idxs = byName.get(key);
    if (!idxs) {
      unmatched.push({ name, arr });
      continue;
    }
    // If the same name exists on multiple hopper rows (rare), apply to all.
    for (const i of idxs) {
      updates.push([seed[i].name, seed[i].arr, arr]);
      seed[i].arr = arr;
      matched++;
    }
    if (arr === 0) skippedZero++;
  }

  writeFileSync(SEED, JSON.stringify(seed, null, 2));

  // Report
  const totalHopperArr = seed
    .filter((r) => r.source === 'hopper')
    .reduce((s, r) => s + (r.arr || 0), 0);
  const hopperCount = seed.filter((r) => r.source === 'hopper').length;

  console.log(`Matched and updated: ${matched} hopper rows`);
  console.log(`CSV rows with arr=0: ${skippedZero}`);
  console.log(`Unmatched CSV rows: ${unmatched.length}`);
  console.log(`Total hopper ARR after merge: $${totalHopperArr.toLocaleString()}`);
  console.log(`Hopper rows in seed: ${hopperCount}`);

  if (unmatched.length) {
    console.log(`\nUnmatched CSV → seed (not found by name):`);
    for (const u of unmatched) {
      console.log(`  $${u.arr.toLocaleString().padStart(10)}  ${u.name}`);
    }
  }

  // Also report hopper rows in seed that still have arr=0 (no CSV match)
  const noArr = seed
    .filter((r) => r.source === 'hopper' && (!r.arr || r.arr === 0))
    .map((r) => r.name);
  if (noArr.length) {
    console.log(`\nHopper rows in seed still at $0 (no CSV row matched):`);
    for (const n of noArr) console.log(`  - ${n}`);
  }
};

main();
