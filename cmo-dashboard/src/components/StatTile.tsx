import { isTileColor } from "@/lib/options";

/**
 * One figure on the top row.
 *
 * The tint is grouping, not encoding: the label says what the number is, so the colour
 * is free to be whatever makes the row easy to scan. The figure itself always wears ink,
 * never the tint — a number in a series colour reads as a category, which it is not.
 *
 * On a tinted tile the sublabel steps up from muted to secondary ink. Muted against a
 * pastel fill lands near 3.2:1, below the plain surface's own ratio; secondary clears
 * 6.6:1 in light and 7.7:1 in dark.
 */
export function StatTile({
  label,
  value,
  sublabel,
  color,
  action,
}: {
  label: string;
  value: string;
  sublabel?: string | null;
  color?: string | null;
  action?: React.ReactNode;
}) {
  const tinted = isTileColor(color);

  return (
    <div
      className={`relative rounded-xl px-3.5 py-3 ${
        tinted ? "" : "border border-subtle bg-surface"
      }`}
      style={
        tinted
          ? {
              background: `var(--tile-${color})`,
              border: `1px solid var(--tile-${color}-edge)`,
            }
          : undefined
      }
    >
      <div className="flex items-start justify-between gap-2">
        <p
          className={`truncate text-[12px] font-semibold ${
            tinted ? "text-ink-secondary" : "text-ink-muted"
          }`}
        >
          {label}
        </p>
        {action}
      </div>

      <p className="mt-1 text-[24px] font-bold leading-none tracking-tight tabular">
        {value}
      </p>

      {sublabel && (
        <p
          className={`mt-1.5 truncate text-[12px] ${
            tinted ? "text-ink-secondary" : "text-ink-muted"
          }`}
          title={sublabel}
        >
          {sublabel}
        </p>
      )}
    </div>
  );
}
