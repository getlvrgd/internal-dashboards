import Link from "next/link";

import { signOut } from "@/app/actions/auth";
import { HubBoard, type HubCard } from "@/components/HubBoard";
import { Logo } from "@/components/Logo";
import { NewDashboardForm } from "@/components/NewDashboardForm";
import { ThemeToggle } from "@/components/ThemeToggle";
import { requireAdmin } from "@/lib/access";
import { isOwner } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { DASHBOARD_STATUS, roleLabel, TASK_STATUS } from "@/lib/options";
import { seedFirstDashboard } from "@/lib/seed";
import { countLinks, parseSopContent } from "@/lib/sops";
import { thisMonday } from "@/lib/week";

export const dynamic = "force-dynamic";

/**
 * The owner's backend: every internal dashboard, and the state of each.
 *
 * Each card carries the four numbers that answer "which one needs me?" without opening
 * any of them — open work this week, clients, people who can sign in, and how much of
 * the SOP library is actually filled in. A dashboard that is a shell shows as one here
 * rather than after a click.
 *
 * Members never see this page; they are sent straight to their own dashboard at sign-in.
 */
export default async function HubPage() {
  const session = await requireAdmin();
  const monday = thisMonday();

  // Creates the CMO dashboard the first time the hub is opened with none.
  //
  // First-run scaffolding normally happens in /setup, but that route closes the moment
  // an owner exists — and an owner created before dashboards were a concept would land
  // here facing an empty page with no route left that could seed one. Idempotent: it
  // does nothing once any dashboard exists, so it costs one count() per visit.
  await seedFirstDashboard();

  const dashboards = await prisma.dashboard.findMany({
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      status: true,
      color: true,
      isTemplate: true,
      sopContent: true,
      _count: { select: { clients: true, memberships: true } },
    },
  });

  // One grouped query rather than a count per dashboard: the card only needs "how much
  // is still open this week", and N+1 round trips for a number that small is not a
  // trade worth making.
  const openByDashboard = await prisma.task.groupBy({
    by: ["dashboardId"],
    where: { weekOf: monday, status: { not: TASK_STATUS.DONE } },
    _count: { _all: true },
  });
  const openCount = new Map(
    openByDashboard.map((row) => [row.dashboardId, row._count._all]),
  );

  const cards: HubCard[] = dashboards.map((dashboard) => {
    const fill = countLinks(parseSopContent(dashboard.sopContent));
    return {
      id: dashboard.id,
      name: dashboard.name,
      slug: dashboard.slug,
      description: dashboard.description,
      status: dashboard.status,
      color: dashboard.color,
      isTemplate: dashboard.isTemplate,
      clients: dashboard._count.clients,
      people: dashboard._count.memberships,
      open: openCount.get(dashboard.id) ?? 0,
      fillDone: fill.done,
      fillTotal: fill.total,
    };
  });

  const totalPeople = await prisma.user.count({ where: { isActive: true } });
  const live = cards.filter((d) => d.status === DASHBOARD_STATUS.LIVE).length;

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-8">
      <header className="flex flex-wrap items-center gap-3">
        <Logo height={22} />
        <span className="text-[13px] font-semibold">Internal dashboards</span>
        <span className="rounded border border-subtle px-1.5 py-0.5 text-[10px] font-bold tracking-widest text-ink-muted uppercase">
          {roleLabel(session.role)}
        </span>

        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/hub/people"
            className="rounded-full border border-subtle px-3 py-1.5 text-[12px] font-semibold"
          >
            People
          </Link>
          <ThemeToggle />
          <form action={signOut}>
            <button className="rounded-full border border-subtle px-3 py-1.5 text-[12px] font-semibold">
              Sign out
            </button>
          </form>
        </div>
      </header>

      <div className="mt-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-bold tracking-tight">
            Your dashboards
          </h1>
          <p className="mt-1 max-w-lg text-[14px] text-ink-secondary">
            Every internal tool you run. Open one to work in it, or add another —
            it starts from the template, with the SOP library already laid out.
          </p>
        </div>
        <NewDashboardForm
          copyOptions={cards.map((d) => ({ id: d.id, name: d.name }))}
          templateName={cards.find((d) => d.isTemplate)?.name ?? null}
        />
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-subtle bg-subtle sm:grid-cols-4">
        <Stat label="Dashboards" value={cards.length} />
        <Stat label="Live" value={live} />
        <Stat
          label="Clients"
          value={cards.reduce((n, d) => n + d.clients, 0)}
        />
        <Stat label="People" value={totalPeople} />
      </dl>

      <HubBoard dashboards={cards} canDelete={isOwner(session)} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-surface px-4 py-3">
      <dt className="text-[10px] font-bold tracking-widest text-ink-muted uppercase">
        {label}
      </dt>
      <dd className="mt-1 text-[22px] font-bold tabular-nums">{value}</dd>
    </div>
  );
}
