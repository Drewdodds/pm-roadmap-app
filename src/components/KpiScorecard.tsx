interface Props {
  label: string;
  value: string;
  emoji?: string;
  bgClass: string;
}

export const KpiScorecard = ({ label, value, emoji, bgClass }: Props) => (
  <div
    className={`flex w-[200px] flex-col justify-center rounded-lg border-2 border-black px-5 py-3 dark:border-slate-600 ${bgClass}`}
  >
    <div className="flex min-h-[1.875rem] items-center justify-between gap-3">
      <span className="text-xs font-semibold uppercase tracking-wide text-primary-900 dark:text-slate-100">
        {label}
      </span>
      {emoji && <span className="text-3xl leading-none">{emoji}</span>}
    </div>
    <span className="mt-1 text-2xl font-bold text-primary-900 dark:text-slate-100">
      {value}
    </span>
  </div>
);
