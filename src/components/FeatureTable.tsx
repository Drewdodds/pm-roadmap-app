import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import type { AoR, Feature, PlanningStatus, ScoringKey } from '../types';
import { SCORING_KEYS, SCORING_LABELS, computeScore } from '../types';

type SortKey = 'index' | 'score' | 'arr';
type SortDir = 'asc' | 'desc';

interface Props {
  features: Feature[];
  onChange: (id: string, patch: Partial<Feature>) => void;
  onToggleScore: (id: string, key: ScoringKey) => void;
  onDelete: (id: string) => void;
}

const NAME_WIDTH_KEY = 'pm-roadmap-app:nameColWidth:v1';
const DEFAULT_NAME_WIDTH = 420;
const MIN_NAME_WIDTH = 180;
const MAX_NAME_WIDTH = 900;

const loadNameWidth = (): number => {
  const raw = localStorage.getItem(NAME_WIDTH_KEY);
  const n = raw ? Number(raw) : DEFAULT_NAME_WIDTH;
  if (!Number.isFinite(n)) return DEFAULT_NAME_WIDTH;
  return Math.max(MIN_NAME_WIDTH, Math.min(MAX_NAME_WIDTH, n));
};

export const FeatureTable = ({
  features,
  onChange,
  onToggleScore,
  onDelete,
}: Props) => {
  const [nameColWidth, setNameColWidth] = useState<number>(loadNameWidth);
  const [sortKey, setSortKey] = useState<SortKey>('index');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [headerOffset, setHeaderOffset] = useState<number>(0);

  useEffect(() => {
    localStorage.setItem(NAME_WIDTH_KEY, String(nameColWidth));
  }, [nameColWidth]);

  useLayoutEffect(() => {
    const el = document.querySelector('header');
    if (!el) return;
    const update = () => setHeaderOffset(el.getBoundingClientRect().height);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const onSortClick = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const startResize = (e: React.PointerEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = nameColWidth;
    const handleMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const next = Math.max(
        MIN_NAME_WIDTH,
        Math.min(MAX_NAME_WIDTH, startWidth + dx),
      );
      setNameColWidth(next);
    };
    const handleUp = () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  };

  const sorted = useMemo(() => {
    const withScore = features.map((f, i) => ({
      f,
      score: computeScore(f.scores),
      originalIndex: i,
    }));
    const mul = sortDir === 'desc' ? -1 : 1;
    withScore.sort((a, b) => {
      if (sortKey === 'index') {
        return mul * (a.originalIndex - b.originalIndex);
      }
      if (sortKey === 'score') {
        const d = a.score - b.score;
        if (d !== 0) return mul * d;
        return mul * (a.f.arr - b.f.arr);
      }
      const d = a.f.arr - b.f.arr;
      if (d !== 0) return mul * d;
      return mul * (a.score - b.score);
    });
    return withScore;
  }, [features, sortKey, sortDir]);

  if (features.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-primary-200 bg-white px-6 py-16 text-center">
        <h2 className="text-lg font-semibold">No features yet</h2>
        <p className="mt-2 text-sm text-primary-300">
          Add a feature manually, load sample data, or import a JSON file.
          <br />
          When the Notion MCP is connected, ask Claude to sync Drew Dodds’ assigned
          records from the Hopper and Feature DB.
        </p>
      </div>
    );
  }

  const nameColStyle = {
    width: nameColWidth,
    minWidth: nameColWidth,
    maxWidth: nameColWidth,
  } as const;

  const stickyTop = { top: 0 } as const;
  const stickyNameStyle = { ...nameColStyle, top: 0 } as const;
  const wrapperStyle =
    headerOffset > 0
      ? { maxHeight: `calc(100vh - ${headerOffset + 60}px)` }
      : undefined;

  return (
    <div
      className="overflow-auto rounded-lg border border-primary-200 bg-white shadow-sm"
      style={wrapperStyle}
    >
      <table className="min-w-full text-sm">
          <thead className="text-xs uppercase tracking-wide text-primary-900">
            <tr>
              <th
                className="sticky left-0 z-[3] bg-primary-100 px-4 py-3 text-left"
                style={stickyTop}
              >
                <SortHeader
                  label="#"
                  active={sortKey === 'index'}
                  dir={sortDir}
                  onClick={() => onSortClick('index')}
                />
              </th>
              <th
                className="sticky z-[2] bg-primary-100 px-4 py-3 text-left"
                style={stickyNameStyle}
              >
                Feature
                <span
                  onPointerDown={startResize}
                  role="separator"
                  aria-orientation="vertical"
                  aria-label="Resize feature column"
                  title="Drag to resize"
                  className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize touch-none select-none bg-transparent hover:bg-primary-300"
                />
              </th>
              <th
                className="sticky z-[2] bg-primary-100 px-4 py-3 text-left"
                style={stickyTop}
              >
                AoR
              </th>
              <th
                className="sticky z-[2] bg-primary-100 px-3 py-3 text-left"
                style={stickyTop}
                title="Flag features that need more research before scoring. Does not contribute to score."
              >
                Follow-up
              </th>
              {SCORING_KEYS.map((k) => (
                <th
                  key={k}
                  className="sticky z-[2] bg-primary-100 px-3 py-3 text-center"
                  style={stickyTop}
                  title={k}
                >
                  {SCORING_LABELS[k]}
                </th>
              ))}
              <th
                className="sticky z-[2] bg-primary-100 px-3 py-3 text-right"
                style={stickyTop}
              >
                <SortHeader
                  label="Score"
                  active={sortKey === 'score'}
                  dir={sortDir}
                  onClick={() => onSortClick('score')}
                />
              </th>
              <th
                className="sticky z-[2] bg-primary-100 px-3 py-3 text-right"
                style={stickyTop}
              >
                <SortHeader
                  label="ARR"
                  active={sortKey === 'arr'}
                  dir={sortDir}
                  onClick={() => onSortClick('arr')}
                />
              </th>
              <th
                className="sticky z-[2] bg-primary-100 px-3 py-3 text-left"
                style={stickyTop}
              >
                Source
              </th>
              <th
                className="sticky z-[2] bg-primary-100 px-3 py-3 text-left"
                style={stickyTop}
                title="Tag features as Committed (next 1-2 quarters) or Icebox (deferred for now)."
              >
                Status
              </th>
              <th
                className="sticky z-[2] bg-primary-100 px-3 py-3"
                style={stickyTop}
              ></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(({ f, score }, idx) => (
              <tr
                key={f.id}
                className={rowClass(f.planningStatus)}
              >
                <td className="sticky left-0 z-[1] bg-white px-4 py-2 text-primary-300">
                  {idx + 1}
                </td>
                <td className="px-4 py-2 align-top" style={nameColStyle}>
                  <input
                    className="block w-full bg-transparent text-primary-900 focus:outline-none"
                    value={f.name}
                    title={f.name}
                    onChange={(e) =>
                      onChange(f.id, { name: e.target.value })
                    }
                  />
                  {f.notionUrl && (
                    <a
                      href={f.notionUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] text-primary-500 hover:underline"
                    >
                      open in Notion ↗
                    </a>
                  )}
                </td>
                <td className="px-4 py-2">
                  <AoRSelect
                    value={f.aor}
                    onChange={(aor) => onChange(f.id, { aor })}
                  />
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={f.needsFollowUp}
                      onChange={(e) =>
                        onChange(f.id, { needsFollowUp: e.target.checked })
                      }
                      className="h-4 w-4 cursor-pointer rounded border-primary-300 text-amber-500 focus:ring-amber-500"
                      title="Needs follow-up"
                    />
                    <input
                      type="text"
                      placeholder="why?"
                      value={f.followUpNote ?? ''}
                      onChange={(e) =>
                        onChange(f.id, {
                          followUpNote: e.target.value || undefined,
                        })
                      }
                      className="w-36 rounded border border-transparent bg-transparent px-1 py-0.5 text-xs hover:border-primary-200 focus:border-primary-500 focus:outline-none"
                    />
                  </div>
                </td>
                {SCORING_KEYS.map((k) => (
                  <td key={k} className="px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={f.scores[k]}
                      onChange={() => onToggleScore(f.id, k)}
                      className="h-4 w-4 cursor-pointer rounded border-primary-300 text-primary-500 focus:ring-primary-500"
                    />
                  </td>
                ))}
                <td className="px-3 py-2 text-right">
                  <span
                    className={`chip ${scoreChipClass(score)}`}
                    title="Sum of boolean scoring columns"
                  >
                    {score}
                  </span>
                </td>
                <td className="px-3 py-2 text-right">
                  <input
                    type="number"
                    min={0}
                    step={1000}
                    value={f.arr}
                    onChange={(e) =>
                      onChange(f.id, { arr: Number(e.target.value) || 0 })
                    }
                    className="w-28 rounded border border-transparent bg-transparent px-1 py-0.5 text-right tabular-nums hover:border-primary-200 focus:border-primary-500 focus:outline-none"
                  />
                </td>
                <td className="px-3 py-2">
                  <span className={`chip ${sourceChipClass(f.source)}`}>
                    {f.source}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <PlanningStatusSelect
                    value={f.planningStatus}
                    onChange={(planningStatus) =>
                      onChange(f.id, { planningStatus })
                    }
                  />
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    onClick={() => onDelete(f.id)}
                    className="text-xs text-primary-300 hover:text-red-600"
                    aria-label="Delete"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
    </div>
  );
};

const SortHeader = ({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className={`inline-flex items-center gap-1 uppercase tracking-wide text-xs font-medium transition-colors ${
      active ? 'text-primary-900' : 'text-primary-900 hover:text-primary-900'
    }`}
    title={active ? `Sorted ${dir === 'desc' ? 'descending' : 'ascending'} — click to toggle` : `Sort by ${label}`}
  >
    {label}
    <span className="text-[10px]">
      {active ? (dir === 'desc' ? '▼' : '▲') : '▼'}
    </span>
  </button>
);

const AoRSelect = ({
  value,
  onChange,
}: {
  value: AoR | null;
  onChange: (v: AoR | null) => void;
}) => (
  <select
    value={value ?? ''}
    onChange={(e) =>
      onChange((e.target.value || null) as AoR | null)
    }
    className="rounded border border-primary-200 bg-white px-2 py-1 text-xs focus:border-primary-500 focus:outline-none"
  >
    <option value="">—</option>
    <option value="Application">Application</option>
    <option value="Profiles">Profiles</option>
  </select>
);

const scoreChipClass = (score: number): string => {
  if (score >= 5) return 'bg-accent-green/20 text-primary-900';
  if (score >= 3) return 'bg-accent-blue text-primary-900';
  if (score >= 1) return 'bg-primary-100 text-primary-900';
  return 'bg-primary-50 text-primary-300';
};

const sourceChipClass = (source: string): string => {
  if (source === 'hopper') return 'bg-accent-lightPurple text-primary-900';
  if (source === 'feature') return 'bg-accent-blue text-primary-900';
  return 'bg-primary-100 text-primary-900';
};

const PlanningStatusSelect = ({
  value,
  onChange,
}: {
  value: PlanningStatus | null;
  onChange: (v: PlanningStatus | null) => void;
}) => (
  <select
    value={value ?? ''}
    onChange={(e) =>
      onChange((e.target.value || null) as PlanningStatus | null)
    }
    className={`rounded border px-2 py-1 text-xs focus:border-primary-500 focus:outline-none ${planningStatusSelectClass(value)}`}
  >
    <option value="">—</option>
    <option value="committed">Committed</option>
    <option value="icebox">Icebox</option>
  </select>
);

const planningStatusSelectClass = (v: PlanningStatus | null): string => {
  if (v === 'committed')
    return 'border-[#31eb14] bg-[#31eb14] text-primary-900 font-medium';
  if (v === 'icebox')
    return 'border-primary-300 bg-primary-100 text-primary-300';
  return 'border-primary-200 bg-white';
};

const rowClass = (status: PlanningStatus | null): string => {
  if (status === 'icebox')
    return 'border-t border-primary-100 opacity-60 hover:bg-primary-50 hover:opacity-100';
  if (status === 'committed')
    return 'border-t border-primary-100 bg-[#9ff393] hover:bg-primary-50';
  return 'border-t border-primary-100 hover:bg-primary-50';
};
