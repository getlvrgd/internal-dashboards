import { createKpi, deleteKpi, updateKpi } from "@/app/actions/kpis";
import { TILE_COLORS } from "@/lib/options";

import { StatTile } from "./StatTile";
import { ghostButtonClass, inputClass, primaryButtonClass } from "./ui";

export type KpiData = {
  id: string;
  label: string;
  value: string;
  sublabel: string | null;
  color: string;
  updatedAt: Date;
};

/**
 * The numbers across the top.
 *
 * Kept by hand rather than pulled from ad platforms. That is a deliberate limit: a
 * dashboard that half-syncs is worse than one that does not, because a stale figure
 * looks exactly like a fresh one. Each tile shows when it was last touched, so an old
 * number admits it.
 *
 * Editing lives behind a disclosure so the default view is the figures alone.
 */
export function KpiBoard({
  kpis,
  editable,
  dashboardSlug,
}: {
  kpis: KpiData[];
  editable: boolean;
  dashboardSlug: string;
}) {
  if (kpis.length === 0 && !editable) return null;

  return (
    <section className="mb-6">
      {kpis.length > 0 && (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
          {kpis.map((kpi) => (
            <StatTile
              key={kpi.id}
              label={kpi.label}
              value={kpi.value}
              sublabel={kpi.sublabel ?? `Updated ${relativeDay(kpi.updatedAt)}`}
              color={kpi.color}
            />
          ))}
        </div>
      )}

      {editable && (
        <details className="group mt-2">
          <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-[12px] font-semibold text-ink-muted transition-colors hover:text-ink">
            <span className="transition-transform group-open:rotate-90">›</span>
            Edit tiles
          </summary>

          <div className="mt-3 space-y-2">
            {kpis.map((kpi) => (
              <form
                key={kpi.id}
                action={updateKpi.bind(null, dashboardSlug)}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-subtle bg-surface p-2"
              >
                <input type="hidden" name="id" value={kpi.id} />
                <input
                  name="label"
                  defaultValue={kpi.label}
                  aria-label="Label"
                  required
                  className={`${inputClass} w-40 flex-1`}
                />
                <input
                  name="value"
                  defaultValue={kpi.value}
                  aria-label="Value"
                  className={`${inputClass} w-24 shrink-0 tabular`}
                />
                <input
                  name="sublabel"
                  defaultValue={kpi.sublabel ?? ""}
                  aria-label="Sublabel"
                  placeholder="vs last month…"
                  className={`${inputClass} w-40 flex-1`}
                />
                <ColorSelect defaultValue={kpi.color} />
                <button type="submit" className={ghostButtonClass}>
                  Save
                </button>
                <button
                  type="submit"
                  formAction={deleteKpi.bind(null, dashboardSlug)}
                  aria-label={`Delete ${kpi.label}`}
                  className="rounded-lg px-2 py-1 text-[12px] font-semibold text-ink-muted transition-colors hover:text-critical"
                >
                  Delete
                </button>
              </form>
            ))}

            <form
              action={createKpi.bind(null, dashboardSlug)}
              className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-subtle p-2"
            >
              <input
                name="label"
                required
                placeholder="New tile label"
                aria-label="New tile label"
                className={`${inputClass} w-40 flex-1`}
              />
              <input
                name="value"
                placeholder="—"
                aria-label="Value"
                className={`${inputClass} w-24 shrink-0 tabular`}
              />
              <input
                name="sublabel"
                placeholder="Sublabel"
                aria-label="Sublabel"
                className={`${inputClass} w-40 flex-1`}
              />
              <ColorSelect />
              <button type="submit" className={primaryButtonClass}>
                Add tile
              </button>
            </form>
          </div>
        </details>
      )}
    </section>
  );
}

function ColorSelect({ defaultValue }: { defaultValue?: string }) {
  return (
    <select
      name="color"
      defaultValue={defaultValue ?? TILE_COLORS[0].value}
      aria-label="Colour"
      className={`${inputClass} w-28 shrink-0`}
    >
      {TILE_COLORS.map((color) => (
        <option key={color.value} value={color.value}>
          {color.label}
        </option>
      ))}
    </select>
  );
}

/**
 * "today" / "yesterday" / "3 days ago". Rendered on the server, so it is the server's
 * idea of today — close enough for a staleness hint, and it avoids a hydration mismatch
 * from formatting the same date in two timezones.
 */
function relativeDay(date: Date) {
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
