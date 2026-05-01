import type { AoR } from '../types';
import { KpiScorecard } from './KpiScorecard';
import { SyncFromHopperCard, type SyncStatus } from './SyncFromHopperCard';
import {
  SyncToHopperCard,
  type SyncToHopperStatus,
} from './SyncToHopperCard';
import { ThemeToggle } from './ThemeToggle';

const SHOW_IO_BUTTONS = false;

interface Props {
  aorFilter: AoR | 'All';
  onAorFilterChange: (v: AoR | 'All') => void;
  sourceFilter: 'All' | 'hopper' | 'feature' | 'manual';
  onSourceFilterChange: (v: 'All' | 'hopper' | 'feature' | 'manual') => void;
  followUpFilter: 'All' | 'NeedsFollowUp' | 'Ready';
  onFollowUpFilterChange: (v: 'All' | 'NeedsFollowUp' | 'Ready') => void;
  statusFilter: 'All' | 'Reviewing' | 'Committed' | 'Icebox';
  onStatusFilterChange: (v: 'All' | 'Reviewing' | 'Committed' | 'Icebox') => void;
  search: string;
  onSearchChange: (v: string) => void;
  count: number;
  totalArr: number;
  onAdd: () => void;
  onLoadSample: () => void;
  onImportJson: (file: File) => void;
  onExportJson: () => void;
  onExportCsv: () => void;
  onClearAll: () => void;
  onIceboxUncommitted: () => void;
  uncommittedCount: number;
  iceboxCount: number;
  committedCount: number;
  layoutWidth: number;
  layoutWidthChanged: boolean;
  onResetLayoutWidth: () => void;
  syncStatus: SyncStatus;
  onSyncFromHopper: () => void;
  syncToHopperStatus: SyncToHopperStatus;
  onSyncToHopper: () => void;
}

const Seg = <T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) => (
  <div className="inline-flex rounded-md border border-primary-200 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-800">
    {options.map((o) => (
      <button
        key={o.value}
        onClick={() => onChange(o.value)}
        className={`rounded px-3 py-1 text-sm font-medium transition-colors ${
          value === o.value
            ? 'bg-primary-500 text-white'
            : 'text-primary-900 hover:bg-primary-100 dark:text-slate-100 dark:hover:bg-slate-700'
        }`}
      >
        {o.label}
      </button>
    ))}
  </div>
);

export const TopBar = (p: Props) => {
  const importRef = (el: HTMLInputElement | null) => {
    if (el) (window as unknown as { _importInput: HTMLInputElement })._importInput = el;
  };
  return (
    <header className="sticky top-0 z-10 border-b border-primary-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      <div className="mx-auto px-6 py-5" style={{ maxWidth: p.layoutWidth }}>
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-xl font-semibold leading-tight">
              Roadmap Scorer
            </h1>
            <p className="text-xs text-primary-300 dark:text-slate-400">
              {p.count} {p.count === 1 ? 'feature' : 'features'} · ARR total{' '}
              {formatArr(p.totalArr)}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <KpiScorecard
              label="Uncommitted"
              value={String(p.uncommittedCount)}
              emoji="💭"
              bgClass="bg-white dark:bg-slate-800"
            />
            <KpiScorecard
              label="Iceboxed"
              value={String(p.iceboxCount)}
              emoji="🧊"
              bgClass="bg-[#BEF1F9] dark:bg-[#1e3a3f]"
            />
            <KpiScorecard
              label="Committed"
              value={String(p.committedCount)}
              emoji="🎯"
              bgClass="bg-[#E8FDEF] dark:bg-[#1d3a26]"
            />
          </div>
          <input
            ref={importRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) p.onImportJson(f);
              e.target.value = '';
            }}
          />
          {SHOW_IO_BUTTONS && (
            <div className="flex items-center gap-2">
              <button
                className="btn-secondary"
                onClick={() =>
                  (
                    window as unknown as { _importInput: HTMLInputElement }
                  )._importInput?.click()
                }
              >
                Import JSON
              </button>
              <button className="btn-secondary" onClick={p.onExportJson}>
                Export JSON
              </button>
              <button className="btn-secondary" onClick={p.onExportCsv}>
                Export CSV
              </button>
            </div>
          )}
          <div className="ml-auto flex items-center gap-3">
            <button
              className="btn-secondary"
              onClick={p.onLoadSample}
              title="Clear and board and load sample data"
            >
              Load sample
            </button>
            <button
              className="btn-secondary"
              onClick={p.onClearAll}
              title="Drop all records from the scoring table (front-end only — does not touch Notion)"
            >
              Clear board
            </button>
            <button
              type="button"
              onClick={p.onAdd}
              className="flex w-[180px] flex-col justify-center rounded-lg border-2 border-black bg-primary-500 px-3 py-2 text-left transition hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-slate-600"
            >
              <div className="flex min-h-[1.5rem] items-center justify-between gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-white">
                  Add feature
                </span>
                <span className="text-2xl leading-none">➕</span>
              </div>
              <span className="mt-0.5 text-[11px] text-white/80">Create manually</span>
            </button>
            <SyncFromHopperCard
              status={p.syncStatus}
              onClick={p.onSyncFromHopper}
            />
            <SyncToHopperCard
              status={p.syncToHopperStatus}
              onClick={p.onSyncToHopper}
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-primary-300 dark:text-slate-400">
              AoR
            </span>
            <Seg
              value={p.aorFilter}
              onChange={p.onAorFilterChange}
              options={[
                { value: 'All', label: 'All' },
                { value: 'Application', label: 'Application' },
                { value: 'Profiles', label: 'Profiles' },
              ]}
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-primary-300 dark:text-slate-400">
              Follow-up
            </span>
            <Seg
              value={p.followUpFilter}
              onChange={p.onFollowUpFilterChange}
              options={[
                { value: 'All', label: 'All' },
                { value: 'NeedsFollowUp', label: 'Needs follow-up' },
                { value: 'Ready', label: 'Ready' },
              ]}
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-primary-300 dark:text-slate-400">
              Source
            </span>
            <Seg
              value={p.sourceFilter}
              onChange={p.onSourceFilterChange}
              options={[
                { value: 'All', label: 'All' },
                { value: 'hopper', label: 'Hopper' },
                { value: 'feature', label: 'Feature DB' },
                { value: 'manual', label: 'Manual' },
              ]}
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-primary-300 dark:text-slate-400">
              Status
            </span>
            <Seg
              value={p.statusFilter}
              onChange={p.onStatusFilterChange}
              options={[
                { value: 'All', label: 'All' },
                { value: 'Reviewing', label: 'Reviewing' },
                { value: 'Committed', label: 'Committed' },
                { value: 'Icebox', label: 'Icebox' },
              ]}
            />
          </div>

          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            {p.layoutWidthChanged && (
              <button
                className="btn-secondary"
                onClick={p.onResetLayoutWidth}
                title="Reset layout width to default"
              >
                Reset width
              </button>
            )}
            <button
              className="btn-secondary"
              onClick={p.onIceboxUncommitted}
              disabled={p.uncommittedCount === 0}
              title="Move all features still in Reviewing status to Icebox"
            >
              Icebox Uncommitted ({p.uncommittedCount})
            </button>
          </div>
          <div className="flex-1 min-w-[200px] max-w-md">
            <input
              className="input"
              placeholder="Search by name…"
              value={p.search}
              onChange={(e) => p.onSearchChange(e.target.value)}
            />
          </div>
        </div>
      </div>
    </header>
  );
};

const formatArr = (n: number): string => {
  if (n === 0) return '$0';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
};
