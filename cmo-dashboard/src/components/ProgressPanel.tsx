import { progressNote } from "@/lib/board";

/**
 * How much of the week is done.
 *
 * The number leads and wears the colour, the sentence beside it says what the number
 * means, and the count sits on the right where it can be checked without being read
 * every morning. A bare "0 of 13" stops registering after a week; this is the one place
 * the app is allowed a voice.
 */
export function ProgressPanel({
  done,
  total,
}: {
  done: number;
  total: number;
}) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  const complete = total > 0 && done === total;

  return (
    <div className="rounded-xl border border-subtle bg-surface px-4 py-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span
          className="text-[22px] font-bold tabular-nums"
          style={{
            color: complete ? "var(--status-good)" : "var(--series-1)",
          }}
        >
          {pct}%
        </span>
        <span className="min-w-0 flex-1 text-[13px] font-semibold text-ink-secondary">
          {progressNote(done, total)}
        </span>
        <span className="shrink-0 text-[12.5px] text-ink-muted tabular-nums">
          {done} of {total} done
        </span>
      </div>

      <div
        className="mt-2.5 h-2 overflow-hidden rounded-full"
        style={{ background: "var(--border-subtle)" }}
        role="img"
        aria-label={`${done} of ${total} tasks done`}
      >
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{
            width: `${pct}%`,
            background: complete ? "var(--status-good)" : "var(--series-1)",
          }}
        />
      </div>
    </div>
  );
}
