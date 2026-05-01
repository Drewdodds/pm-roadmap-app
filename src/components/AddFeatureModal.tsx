import { useState } from 'react';
import type { AoR, Feature } from '../types';
import { emptyScores } from '../types';

interface Props {
  onClose: () => void;
  onAdd: (f: Feature) => void;
}

export const AddFeatureModal = ({ onClose, onAdd }: Props) => {
  const [name, setName] = useState('');
  const [aor, setAor] = useState<AoR | ''>('');
  const [arr, setArr] = useState<number>(0);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onAdd({
      id: crypto.randomUUID(),
      name: name.trim(),
      aor: (aor || null) as AoR | null,
      arr,
      scores: emptyScores(),
      source: 'manual',
      needsFollowUp: false,
      planningStatus: null,
      customerIds: [],
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-primary-900/40 dark:bg-black/60"
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-slate-800 dark:border dark:border-slate-700"
      >
        <h2 className="text-lg font-semibold">Add feature</h2>
        <p className="mt-1 text-xs text-primary-300 dark:text-slate-400">
          Fill basics now, score the booleans in the table.
        </p>

        <label className="mt-4 block text-xs font-medium text-primary-900 dark:text-slate-100">
          Feature name
        </label>
        <input
          autoFocus
          className="input mt-1"
          placeholder="e.g. HubSpot batch upsert"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <label className="mt-3 block text-xs font-medium text-primary-900 dark:text-slate-100">
          AoR
        </label>
        <select
          className="input mt-1"
          value={aor}
          onChange={(e) => setAor(e.target.value as AoR | '')}
        >
          <option value="">— Select —</option>
          <option value="Application">Application</option>
          <option value="Profiles">Profiles</option>
        </select>

        <label className="mt-3 block text-xs font-medium text-primary-900 dark:text-slate-100">
          ARR attached ($)
        </label>
        <input
          type="number"
          min={0}
          step={1000}
          className="input mt-1 tabular-nums"
          value={arr}
          onChange={(e) => setArr(Number(e.target.value) || 0)}
        />

        <div className="mt-6 flex items-center justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary">
            Add
          </button>
        </div>
      </form>
    </div>
  );
};
