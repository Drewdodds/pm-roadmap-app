export type SyncStatus =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | {
      kind: 'success';
      total: number;
      added: number;
      updated: number;
      customersAdded: number;
      customersUpdated: number;
    }
  | { kind: 'error'; message: string };

interface Props {
  status: SyncStatus;
  onClick: () => void;
}

const Spinner = () => (
  <svg
    className="h-5 w-5 animate-spin text-primary-900 dark:text-slate-100"
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
  >
    <circle
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="3"
      strokeOpacity="0.25"
    />
    <path
      d="M22 12a10 10 0 0 0-10-10"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
    />
  </svg>
);

export const SyncFromHopperCard = ({ status, onClick }: Props) => {
  const isLoading = status.kind === 'loading';

  let subtitle: React.ReactNode = (
    <span className="text-primary-300 dark:text-slate-400">Pull new records</span>
  );
  if (status.kind === 'loading') {
    subtitle = (
      <span className="text-primary-900 dark:text-slate-100">Syncing…</span>
    );
  } else if (status.kind === 'success') {
    subtitle = (
      <span className="text-primary-900 dark:text-slate-100">
        <span className="font-semibold">{status.added}</span> new ·{' '}
        <span className="font-semibold">{status.updated}</span> updated ·{' '}
        <span className="font-semibold">{status.total}</span> returned
      </span>
    );
  } else if (status.kind === 'error') {
    subtitle = (
      <span className="text-red-600 dark:text-red-400" title={status.message}>
        {status.message.length > 32
          ? `${status.message.slice(0, 32)}…`
          : status.message}
      </span>
    );
  }

  const rightIcon =
    status.kind === 'loading' ? (
      <Spinner />
    ) : status.kind === 'error' ? (
      <span className="text-2xl leading-none">⚠️</span>
    ) : (
      <img src="/loop.png" alt="" className="h-6 w-6 object-contain" />
    );

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isLoading}
      title="Pull new records from the Notion Hopper. Existing records are kept untouched."
      className={`flex w-[180px] flex-col justify-center rounded-lg border-2 border-black bg-indigo-50 px-3 py-2 text-left transition hover:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:cursor-wait disabled:hover:bg-indigo-50 dark:border-slate-600 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/40 dark:disabled:hover:bg-indigo-950/40`}
    >
      <div className="flex min-h-[1.5rem] items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-primary-900 dark:text-slate-100">
          Sync from Hopper
        </span>
        {rightIcon}
      </div>
      <span className="mt-0.5 text-[11px]">{subtitle}</span>
    </button>
  );
};
