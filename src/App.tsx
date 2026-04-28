import { useEffect, useMemo, useState } from 'react';
import { TopBar } from './components/TopBar';
import { FeatureTable } from './components/FeatureTable';
import { AddFeatureModal } from './components/AddFeatureModal';
import { ContextCard } from './components/ContextCard';
import { ContextItemModal } from './components/ContextItemModal';
import type { AoR, ContextItem, Feature, ScoringKey } from './types';
import {
  DEFAULT_LAYOUT_WIDTH,
  MIN_LAYOUT_WIDTH,
  exportCSV,
  exportJSON,
  importJSON,
  loadContextItems,
  loadFeatures,
  loadLayoutWidth,
  saveContextItems,
  saveFeatures,
  saveLayoutWidth,
} from './storage';
import { sampleFeatures } from './sampleData';

type SourceFilter = 'All' | 'hopper' | 'feature' | 'manual';
type FollowUpFilter = 'All' | 'NeedsFollowUp' | 'Ready';
type StatusFilter = 'All' | 'Reviewing' | 'Committed' | 'Icebox';

export default function App() {
  const [features, setFeatures] = useState<Feature[]>(() => loadFeatures());
  const [strategies, setStrategies] = useState<ContextItem[]>(() =>
    loadContextItems('strategies'),
  );
  const [osts, setOsts] = useState<ContextItem[]>(() => loadContextItems('osts'));
  const [aorFilter, setAorFilter] = useState<AoR | 'All'>('All');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('All');
  const [followUpFilter, setFollowUpFilter] = useState<FollowUpFilter>('All');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [showAddStrategy, setShowAddStrategy] = useState(false);
  const [showAddOst, setShowAddOst] = useState(false);
  const [layoutWidth, setLayoutWidth] = useState<number>(loadLayoutWidth);
  const [viewportWidth, setViewportWidth] = useState<number>(() =>
    typeof window !== 'undefined' ? window.innerWidth : DEFAULT_LAYOUT_WIDTH,
  );

  useEffect(() => {
    saveLayoutWidth(layoutWidth);
  }, [layoutWidth]);

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const maxLayoutWidth = Math.max(MIN_LAYOUT_WIDTH, viewportWidth - 48);
  const effectiveLayoutWidth = Math.min(layoutWidth, maxLayoutWidth);
  const layoutWidthChanged = layoutWidth !== DEFAULT_LAYOUT_WIDTH;

  const startLayoutResize = (e: React.PointerEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = effectiveLayoutWidth;
    const handleMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const next = Math.max(
        MIN_LAYOUT_WIDTH,
        Math.min(maxLayoutWidth, startWidth + 2 * dx),
      );
      setLayoutWidth(next);
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

  const resetLayoutWidth = () => setLayoutWidth(DEFAULT_LAYOUT_WIDTH);

  useEffect(() => {
    saveFeatures(features);
  }, [features]);

  useEffect(() => {
    saveContextItems('strategies', strategies);
  }, [strategies]);

  useEffect(() => {
    saveContextItems('osts', osts);
  }, [osts]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return features.filter((f) => {
      if (aorFilter !== 'All' && f.aor !== aorFilter) return false;
      if (sourceFilter !== 'All' && f.source !== sourceFilter) return false;
      if (followUpFilter === 'NeedsFollowUp' && !f.needsFollowUp) return false;
      if (followUpFilter === 'Ready' && f.needsFollowUp) return false;
      if (statusFilter === 'Reviewing' && f.planningStatus !== null) return false;
      if (statusFilter === 'Committed' && f.planningStatus !== 'committed')
        return false;
      if (statusFilter === 'Icebox' && f.planningStatus !== 'icebox')
        return false;
      if (q && !f.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [features, aorFilter, sourceFilter, followUpFilter, statusFilter, search]);

  const totalArr = useMemo(
    () => filtered.reduce((sum, f) => sum + f.arr, 0),
    [filtered],
  );

  const updateFeature = (id: string, patch: Partial<Feature>) =>
    setFeatures((prev) =>
      prev.map((f) => (f.id === id ? { ...f, ...patch } : f)),
    );

  const toggleScore = (id: string, key: ScoringKey) =>
    setFeatures((prev) =>
      prev.map((f) =>
        f.id === id
          ? { ...f, scores: { ...f.scores, [key]: !f.scores[key] } }
          : f,
      ),
    );

  const deleteFeature = (id: string) =>
    setFeatures((prev) => prev.filter((f) => f.id !== id));

  const uncommittedCount = useMemo(
    () => features.filter((f) => f.planningStatus === null).length,
    [features],
  );

  const iceboxCount = useMemo(
    () => features.filter((f) => f.planningStatus === 'icebox').length,
    [features],
  );
  const committedCount = useMemo(
    () => features.filter((f) => f.planningStatus === 'committed').length,
    [features],
  );

  const iceboxUncommitted = () => {
    if (uncommittedCount === 0) {
      alert('No uncommitted features to icebox.');
      return;
    }
    if (
      !confirm(
        `Move ${uncommittedCount} uncommitted ${uncommittedCount === 1 ? 'feature' : 'features'} to Icebox?`,
      )
    )
      return;
    setFeatures((prev) =>
      prev.map((f) =>
        f.planningStatus === null ? { ...f, planningStatus: 'icebox' } : f,
      ),
    );
  };

  const addFeature = (f: Feature) => setFeatures((prev) => [f, ...prev]);

  const addStrategy = (item: ContextItem) =>
    setStrategies((prev) => [item, ...prev]);
  const deleteStrategy = (id: string) =>
    setStrategies((prev) => prev.filter((i) => i.id !== id));

  const addOst = (item: ContextItem) => setOsts((prev) => [item, ...prev]);
  const deleteOst = (id: string) =>
    setOsts((prev) => prev.filter((i) => i.id !== id));

  const loadSample = () => {
    setFeatures(sampleFeatures());
  };

  const handleImport = async (file: File) => {
    try {
      const imported = await importJSON(file);
      if (
        features.length > 0 &&
        !confirm(
          `Replace ${features.length} features with ${imported.length} imported?`,
        )
      )
        return;
      setFeatures(imported);
    } catch (err) {
      alert(`Import failed: ${(err as Error).message}`);
    }
  };

  const clearAll = () => {
    setFeatures([]);
  };

  return (
    <div className="min-h-screen">
      <TopBar
        aorFilter={aorFilter}
        onAorFilterChange={setAorFilter}
        sourceFilter={sourceFilter}
        onSourceFilterChange={setSourceFilter}
        followUpFilter={followUpFilter}
        onFollowUpFilterChange={setFollowUpFilter}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        search={search}
        onSearchChange={setSearch}
        count={filtered.length}
        totalArr={totalArr}
        onAdd={() => setShowAdd(true)}
        onLoadSample={loadSample}
        onImportJson={handleImport}
        onExportJson={() => exportJSON(features)}
        onExportCsv={() => exportCSV(features)}
        onClearAll={clearAll}
        onIceboxUncommitted={iceboxUncommitted}
        uncommittedCount={uncommittedCount}
        iceboxCount={iceboxCount}
        committedCount={committedCount}
        layoutWidth={effectiveLayoutWidth}
        layoutWidthChanged={layoutWidthChanged}
        onResetLayoutWidth={resetLayoutWidth}
      />
      <div
        className="relative mx-auto px-6 py-6"
        style={{ maxWidth: effectiveLayoutWidth }}
      >
        <div className="flex gap-4">
          <aside className="hidden w-72 shrink-0 xl:block">
            <div className="sticky top-[160px] max-h-[calc(100vh-180px)] space-y-4 overflow-y-auto pr-1">
              <ContextCard
                label="Company strategies"
                emptyHint="Add company strategies so they stay in view while you score features."
                items={strategies}
                onAdd={() => setShowAddStrategy(true)}
                onDelete={deleteStrategy}
              />
              <ContextCard
                label="OSTs"
                emptyHint="Add Objectives, Solutions, and Tactics to anchor scoring decisions."
                items={osts}
                onAdd={() => setShowAddOst(true)}
                onDelete={deleteOst}
              />
            </div>
          </aside>
          <main className="min-w-0 flex-1">
            <FeatureTable
              features={filtered}
              onChange={updateFeature}
              onToggleScore={toggleScore}
              onDelete={deleteFeature}
            />
          </main>
        </div>
        <span
          onPointerDown={startLayoutResize}
          onDoubleClick={resetLayoutWidth}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize layout width"
          title="Drag to resize layout. Double-click to reset."
          className="absolute right-0 top-0 z-[5] h-full w-2 cursor-col-resize touch-none select-none bg-transparent hover:bg-primary-300"
        />
      </div>
      {showAdd && (
        <AddFeatureModal
          onClose={() => setShowAdd(false)}
          onAdd={addFeature}
        />
      )}
      {showAddStrategy && (
        <ContextItemModal
          label="company strategy"
          titlePlaceholder="e.g. Win the warehouse-native segment"
          descriptionPlaceholder="Optional context, owners, links…"
          onClose={() => setShowAddStrategy(false)}
          onAdd={addStrategy}
        />
      )}
      {showAddOst && (
        <ContextItemModal
          label="OST"
          titlePlaceholder="e.g. Increase activated workspaces 20% this half"
          descriptionPlaceholder="Objective, target metric, owning team…"
          onClose={() => setShowAddOst(false)}
          onAdd={addOst}
        />
      )}
    </div>
  );
}
