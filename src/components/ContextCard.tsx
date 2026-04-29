import type { ContextItem } from '../types';

interface Props {
  label: string;
  emptyHint: string;
  items: ContextItem[];
  onAdd: () => void;
  onDelete: (id: string) => void;
}

export const ContextCard = ({
  label,
  emptyHint,
  items,
  onAdd,
  onDelete,
}: Props) => (
  <section className="rounded-lg border border-primary-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
    <header className="flex items-center justify-between border-b border-primary-100 px-3 py-2 dark:border-slate-700">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-primary-900 dark:text-slate-100">
        {label}
      </h3>
      <button
        onClick={onAdd}
        className="text-xs font-medium text-primary-500 hover:text-primary-600 dark:text-primary-400 dark:hover:text-primary-300"
      >
        + Add
      </button>
    </header>
    {items.length === 0 ? (
      <p className="px-3 py-4 text-xs text-primary-300 dark:text-slate-400">
        {emptyHint}
      </p>
    ) : (
      <ul className="divide-y divide-primary-100 dark:divide-slate-700">
        {items.map((item) => (
          <li key={item.id} className="group px-3 py-2">
            <div className="flex items-start justify-between gap-2">
              <h4 className="text-sm font-medium text-primary-900 dark:text-slate-100">
                {item.title}
              </h4>
              <button
                onClick={() => onDelete(item.id)}
                aria-label="Delete"
                className="text-xs text-primary-300 opacity-0 transition-opacity hover:text-red-600 group-hover:opacity-100 dark:text-slate-500 dark:hover:text-red-400"
              >
                ✕
              </button>
            </div>
            {item.description && (
              <p className="mt-1 whitespace-pre-wrap text-xs text-primary-300 dark:text-slate-400">
                {item.description}
              </p>
            )}
          </li>
        ))}
      </ul>
    )}
  </section>
);
