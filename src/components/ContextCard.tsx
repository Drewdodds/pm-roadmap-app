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
  <section className="rounded-lg border border-primary-200 bg-white shadow-sm">
    <header className="flex items-center justify-between border-b border-primary-100 px-3 py-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-primary-900">
        {label}
      </h3>
      <button
        onClick={onAdd}
        className="text-xs font-medium text-primary-500 hover:text-primary-600"
      >
        + Add
      </button>
    </header>
    {items.length === 0 ? (
      <p className="px-3 py-4 text-xs text-primary-300">{emptyHint}</p>
    ) : (
      <ul className="divide-y divide-primary-100">
        {items.map((item) => (
          <li key={item.id} className="group px-3 py-2">
            <div className="flex items-start justify-between gap-2">
              <h4 className="text-sm font-medium text-primary-900">
                {item.title}
              </h4>
              <button
                onClick={() => onDelete(item.id)}
                aria-label="Delete"
                className="text-xs text-primary-300 opacity-0 transition-opacity hover:text-red-600 group-hover:opacity-100"
              >
                ✕
              </button>
            </div>
            {item.description && (
              <p className="mt-1 whitespace-pre-wrap text-xs text-primary-300">
                {item.description}
              </p>
            )}
          </li>
        ))}
      </ul>
    )}
  </section>
);
