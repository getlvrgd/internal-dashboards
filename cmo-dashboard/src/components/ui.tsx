import { isTileColor } from "@/lib/options";

/**
 * The handful of shapes every page reuses.
 *
 * These are class strings and thin wrappers rather than a component library: the app is
 * small enough that a `<Card>` with six props would cost more than it saves, but leaving
 * the same twelve Tailwind classes copied across nine files is how a design drifts.
 */

export const inputClass =
  "w-full rounded-lg border border-subtle bg-surface px-3 py-2 text-sm outline-none focus:border-accent";

export const labelClass = "block text-[13px] font-semibold text-ink-secondary";

export const cardClass = "rounded-xl border border-subtle bg-surface";

export const primaryButtonClass =
  "rounded-full bg-ink px-3.5 py-2 text-[13px] font-bold text-page transition-opacity hover:opacity-85 disabled:opacity-60";

export const ghostButtonClass =
  "rounded-full border border-subtle px-3.5 py-2 text-[13px] font-semibold text-ink-secondary transition-colors hover:border-strong hover:text-ink disabled:opacity-60";

export const quietButtonClass =
  "rounded-lg px-2 py-1 text-[12px] font-semibold text-ink-muted transition-colors hover:text-ink";

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      <div className="mt-1">{children}</div>
      {hint && <p className="mt-1 text-[12px] text-ink-muted">{hint}</p>}
    </label>
  );
}

export function SectionHeading({
  title,
  count,
  action,
}: {
  title: string;
  count?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-end justify-between gap-4">
      <h2 className="text-[15px] font-bold tracking-tight">
        {title}
        {count && (
          <span className="ml-2 text-[13px] font-semibold text-ink-muted tabular">
            {count}
          </span>
        )}
      </h2>
      {action}
    </div>
  );
}

/**
 * A small tinted label — a client name, a day, a category.
 *
 * The tint is decoration, never the meaning: the text inside always says what the chip
 * is, so two clients landing on neighbouring colours is a cosmetic matter rather than a
 * misread. `isTileColor` guards the value before it reaches the style attribute,
 * because it arrives from a stored row.
 */
export function Chip({
  children,
  color,
  className = "",
}: {
  children: React.ReactNode;
  color?: string | null;
  className?: string;
}) {
  const tinted = isTileColor(color);
  return (
    <span
      className={`inline-flex max-w-full items-center truncate rounded-md px-1.5 py-0.5 text-[12px] font-semibold ${
        tinted ? "" : "border border-subtle text-ink-secondary"
      } ${className}`}
      style={
        tinted
          ? {
              background: `var(--tile-${color})`,
              border: `1px solid var(--tile-${color}-edge)`,
            }
          : undefined
      }
    >
      {children}
    </span>
  );
}

/** A coloured dot beside a word. The word carries the meaning; the dot is the glance. */
export function Dot({ tint }: { tint: string }) {
  return (
    <span
      aria-hidden
      className="inline-block size-[7px] shrink-0 rounded-full"
      style={{ background: tint }}
    />
  );
}

export function EmptyNote({ children }: { children: React.ReactNode }) {
  return <p className="py-3 text-[13px] text-ink-muted">{children}</p>;
}
