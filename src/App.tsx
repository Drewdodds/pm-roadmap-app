import { useEffect, useMemo, useState } from 'react';
import { TopBar } from './components/TopBar';
import { FeatureTable } from './components/FeatureTable';
import { AddFeatureModal } from './components/AddFeatureModal';
import { ContextCard } from './components/ContextCard';
import { ContextItemModal } from './components/ContextItemModal';
import type { AoR, ContextItem, Feature, ScoringKey } from './types';
import {
  exportCSV,
  exportJSON,
  importJSON,
  loadContextItems,
  loadFeatures,
  saveContextItems,
  saveFeatures,
} from './storage';
import { sampleFeatures } from './sampleData';

type SourceFilter = 'All' | 'hopper' | 'feature' | 'manual';
type FollowUpFilter = 'All' | 'NeedsFollowUp' | 'Ready';

export default function App() {
  const [features, setFeatures] = useState<Feature[]>(() => loadFeatures());
  const [strategies, setStrategies] = useState<ContextItem[]>(() =>
    loadContextItems('strategies'),
  );
  const [osts, setOsts] = useState<ContextItem[]>(() => loadContextItems('osts'));
  const [aorFilter, setAorFilter] = useState<AoR | 'All'>('All');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('All');
  const [followUpFilter, setFollowUpFilter] = useState<FollowUpFilter>('All');
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [showAddStrategy, setShowAddStrategy] = useState(false);
  const [showAddOst, setShowAddOst] = useState(false);

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
      if (q && !f.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [features, aorFilter, sourceFilter, followUpFilter, search]);

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
      />
      <div className="mx-auto max-w-[2100px] px-6 py-6">
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
