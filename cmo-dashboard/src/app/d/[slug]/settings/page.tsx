import {
  deleteDashboard,
  setTemplate,
  updateDashboard,
} from "@/app/actions/dashboards";
import { DangerButton } from "@/components/DangerButton";
import { Nav } from "@/components/Nav";
import {
  ghostButtonClass,
  inputClass,
  primaryButtonClass,
} from "@/components/ui";
import { requireDashboardManager } from "@/lib/access";
import { isOwner } from "@/lib/auth";
import {
  DASHBOARD_STATUS,
  DASHBOARD_STATUSES,
  TILE_COLORS,
} from "@/lib/options";

export const dynamic = "force-dynamic";

/** Name, description, status, colour — and the two irreversible buttons. */
export default async function SettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const context = await requireDashboardManager(slug);
  const { dashboard, session } = context;

  return (
    <>
      <Nav session={session} dashboard={dashboard} context={context} />

      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-6">
        <h1 className="mb-5 text-[22px] font-extrabold tracking-[-0.08em]">Settings</h1>

        <form
          action={updateDashboard.bind(null, slug)}
          className="grid gap-3 rounded-xl border border-subtle bg-surface p-4"
        >
          <label className="block">
            <span className="text-[11px] font-bold tracking-widest text-ink-muted uppercase">
              Name
            </span>
            <input
              name="name"
              required
              maxLength={80}
              defaultValue={dashboard.name}
              className={`${inputClass} mt-1 w-full`}
            />
          </label>

          <label className="block">
            <span className="text-[11px] font-bold tracking-widest text-ink-muted uppercase">
              Description
            </span>
            <input
              name="description"
              maxLength={240}
              defaultValue={dashboard.description ?? ""}
              className={`${inputClass} mt-1 w-full`}
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-[11px] font-bold tracking-widest text-ink-muted uppercase">
                Status
              </span>
              <select
                name="status"
                defaultValue={dashboard.status}
                className={`${inputClass} mt-1 w-full`}
              >
                {DASHBOARD_STATUSES.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-[11px] font-bold tracking-widest text-ink-muted uppercase">
                Colour
              </span>
              <select
                name="color"
                defaultValue={dashboard.color}
                className={`${inputClass} mt-1 w-full`}
              >
                {TILE_COLORS.map((color) => (
                  <option key={color.value} value={color.value}>
                    {color.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div>
            <button type="submit" className={primaryButtonClass}>
              Save
            </button>
          </div>

          <p className="text-[12px] text-ink-muted">
            {dashboard.status === DASHBOARD_STATUS.DRAFT
              ? "While it is a draft the address follows the name. Once it goes live the address is fixed, so links you have shared keep working."
              : `The address stays /d/${dashboard.slug} — renaming will not break links anyone has already saved.`}
          </p>
        </form>

        <section className="mt-6 rounded-xl border border-subtle bg-surface p-4">
          <h2 className="text-[13px] font-extrabold tracking-[-0.08em]">Template</h2>
          <p className="mt-1 text-[12.5px] text-ink-secondary">
            {dashboard.isTemplate
              ? "New dashboards are cloned from this one — its SOP library and KPI row, never its clients or its week."
              : "Make this the dashboard new ones start from."}
          </p>
          {!dashboard.isTemplate && (
            <form action={setTemplate.bind(null, slug)} className="mt-3">
              <button type="submit" className={ghostButtonClass}>
                Use as template
              </button>
            </form>
          )}
        </section>

        {/* Deleting is the owner's alone: a dashboard holds a team's whole year of work,
            and an admin having the same button as the person who owns the business is
            not a trade worth making. */}
        {isOwner(session) && (
          <section className="mt-6 rounded-xl border border-subtle p-4">
            <h2 className="text-[13px] font-extrabold tracking-[-0.08em] text-critical">
              Delete this dashboard
            </h2>
            <p className="mt-1 text-[12.5px] text-ink-secondary">
              Its clients, tasks, KPIs, logins and access all go with it. There is
              no undo.
            </p>
            <form action={deleteDashboard.bind(null, slug)} className="mt-3">
              <DangerButton
                confirm={`Delete ${dashboard.name} and everything in it? This cannot be undone.`}
                className="text-[13px] font-semibold text-critical underline-offset-2 hover:underline"
              >
                Delete {dashboard.name}
              </DangerButton>
            </form>
          </section>
        )}
      </main>
    </>
  );
}
