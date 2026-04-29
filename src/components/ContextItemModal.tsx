import { useState } from 'react';
import type { ContextItem } from '../types';

interface Props {
  label: string;
  titlePlaceholder?: string;
  descriptionPlaceholder?: string;
  onClose: () => void;
  onAdd: (item: ContextItem) => void;
}

export const ContextItemModal = ({
  label,
  titlePlaceholder,
  descriptionPlaceholder,
  onClose,
  onAdd,
}: Props) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onAdd({
      id: crypto.randomUUID(),
      title: title.trim(),
      description: description.trim(),
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
        <h2 className="text-lg font-semibold">Add {label}</h2>

        <label className="mt-4 block text-xs font-medium text-primary-900 dark:text-slate-100">
          Title
        </label>
        <input
          autoFocus
          className="input mt-1"
          placeholder={titlePlaceholder}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <label className="mt-3 block text-xs font-medium text-primary-900 dark:text-slate-100">
          Description
        </label>
        <textarea
          className="input mt-1 min-h-[120px] resize-y"
          placeholder={descriptionPlaceholder}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
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
