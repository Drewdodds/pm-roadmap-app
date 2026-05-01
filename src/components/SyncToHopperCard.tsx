export type SyncToHopperStatus =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | {
      kind: 'success';
      created: number;
      committed: number;
      iceboxed: number;
      reviewingSkipped: number;
      alreadyInFeatureDb: number;
    }
  | { kind: 'error'; message: string };

interface Props {
  status: SyncToHopperStatus;
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

export const SyncToHopperCard = ({ status, onClick }: Props) => {
  const isLoading = status.kind === 'loading';

  let subtitle: React.ReactNode = (
    <span className="text-primary-300 dark:text-slate-400">
      Push decisions to Notion
    </span>
  );
  let titleAttr = 'Push local commit/icebox decisions back to the Notion Hopper.';
  if (status.kind === 'loading') {
    subtitle = (
      <span className="text-primary-900 dark:text-slate-100">Syncing…</span>
    );
  } else if (status.kind === 'success') {
    subtitle = (
      <span className="text-primary-900 dark:text-slate-100">
        <span className="font-semibold">{status.created}</span> created ·{' '}
        <span className="font-semibold">{status.committed}</span> committed ·{' '}
        <span className="font-semibold">{status.iceboxed}</span> iceboxed
      </span>
    );
    titleAttr =
      `${status.created} created · ${status.committed} committed · ` +
      `${status.iceboxed} iceboxed · ` +
      `${status.reviewingSkipped} skipped (reviewing) · ` +
      `${status.alreadyInFeatureDb} skipped (already in Feature DB)`;
  } else if (status.kind === 'error') {
    subtitle = (
      <span className="text-red-600 dark:text-red-400" title={status.message}>
        {status.message.length > 32
          ? `${status.message.slice(0, 32)}…`
          : status.message}
      </span>
    );
    titleAttr = status.message;
  }

  const rightIcon =
    status.kind === 'loading' ? (
      <Spinner />
    ) : status.kind === 'error' ? (
      <span className="text-2xl leading-none">⚠️</span>
    ) : (
      <img
        src="/sync.png"
        alt=""
        aria-hidden="true"
        className="h-6 w-6 dark:invert"
      />
    );

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isLoading}
      title={titleAttr}
      className="flex w-[180px] flex-col justify-center rounded-lg border-2 border-black bg-green-50 px-3 py-2 text-left transition hover:bg-green-100 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:cursor-wait disabled:hover:bg-green-50 dark:border-slate-600 dark:bg-green-950/40 dark:hover:bg-green-900/40 dark:disabled:hover:bg-green-950/40"
    >
      <div className="flex min-h-[1.5rem] items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-primary-900 dark:text-slate-100">
          Sync to Hopper
        </span>
        {rightIcon}
      </div>
      <span className="mt-0.5 text-[11px]">{subtitle}</span>
    </button>
  );
};
