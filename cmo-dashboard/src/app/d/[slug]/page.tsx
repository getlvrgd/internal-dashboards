import Link from "next/link";

import { carryOverLastWeek } from "@/app/actions/tasks";
import { BoardShell } from "@/components/BoardShell";
import { CallsPanel } from "@/components/CallsPanel";
import { KpiBoard } from "@/components/KpiBoard";
import { Nav } from "@/components/Nav";
import { OfferDirectory, type OfferEntry } from "@/components/OfferDirectory";
import { DailyPanel } from "@/components/DailyPanel";
import { DailyProgress } from "@/components/DailyProgress";
import { RevenuePanel } from "@/components/RevenuePanel";
import { TaskList } from "@/components/TaskList";
import type { RowOption } from "@/components/TaskRow";
import { TaskStoreProvider } from "@/components/TaskStore";
import { Chip, ghostButtonClass } from "@/components/ui";
import { resolveDashboard } from "@/lib/access";
import { saveBoardLayout } from "@/app/actions/board";
import { DEFAULT_PANELS, parseBoardLayout } from "@/lib/board";
import { type BoardTask } from "@/lib/tasks";
import { prisma } from "@/lib/db";
import { daysInMonthUTC, startOfDayUTC, startOfMonthUTC } from "@/lib/money";
import { DAYS, dayTint } from "@/lib/options";
import {
  addWeeks,
  countCarryable,
  dateOfDay,
  ensureWeek,
  formatWeekRange,
  parseWeekParam,
  thisMonday,
  todayIndex,
  weekParam,
} from "@/lib/week";

export const dynamic = "force-dynamic";

type Search = { week?: string; client?: string; person?: string };

/**
 * The board.
 *
 * No longer a fixed page: progress, revenue, numbers, the to-do list, the week and the
 * calls are panels whose order and headings live on the dashboard, so this file decides
 * what each panel *is* and BoardShell decides where it goes.
 *
 * The week is still in the URL rather than in state, so a particular week is a link you
 * can send someone.
 */
export default async function BoardPage({
  params: routeParams,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Search>;
}) {
  const { slug } = await routeParams;
  const context = await resolveDashboard(slug);
  const { dashboard, session } = context;
  const editable = context.canManage;
  const params = await searchParams;

  const monday = parseWeekParam(params.week);
  const week = weekParam(monday);

  // Clones the standing routine the first time a week is opened. Safe to call on every
  // render — it does nothing once the week holds any task at all.
  await ensureWeek(dashboard.id, monday);

  const clientFilter = params.client ?? "";
  const personFilter = params.person ?? "";

  const now = new Date();
  const todayStart = startOfDayUTC(now);
  const monthStart = startOfMonthUTC(now);

  const [
    weekTasks,
    todos,
    clientRows,
    people,
    kpis,
    lastWeekTasks,
    calls,
    monthPayments,
  ] = await Promise.all([
    prisma.task.findMany({
      where: {
        dashboardId: dashboard.id,
        weekOf: monday,
        ...(clientFilter ? { clientId: clientFilter } : {}),
        ...(personFilter ? { assigneeId: personFilter } : {}),
      },
      orderBy: [{ day: "asc" }, { position: "asc" }, { createdAt: "asc" }],
    }),
    prisma.task.findMany({
      where: {
        dashboardId: dashboard.id,
        weekOf: null,
        ...(clientFilter ? { clientId: clientFilter } : {}),
        ...(personFilter ? { assigneeId: personFilter } : {}),
      },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    }),
    prisma.client.findMany({
      where: { dashboardId: dashboard.id, status: { not: "CHURNED" } },
      orderBy: [{ position: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        slug: true,
        color: true,
        assetsContent: true,
      },
    }),
    // Who a task can be assigned to: this dashboard's members, plus the owner and
    // admins, who reach every dashboard without a membership row.
    prisma.user.findMany({
      where: {
        isActive: true,
        OR: [
          { memberships: { some: { dashboardId: dashboard.id } } },
          { role: { in: ["OWNER", "ADMIN"] } },
        ],
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.kpi.findMany({
      where: { dashboardId: dashboard.id },
      orderBy: { position: "asc" },
    }),
    prisma.task.findMany({
      where: { dashboardId: dashboard.id, weekOf: addWeeks(monday, -1) },
      select: { recurring: true, status: true },
    }),
    prisma.call.findMany({
      // Only the dashboard's own calls; an offer's calls live on that offer's board.
      where: { dashboardId: dashboard.id, clientId: null },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    }),
    // The whole month in one query; today's rows are filtered out of it below rather
    // than fetched again.
    prisma.payment.findMany({
      where: { dashboardId: dashboard.id, receivedAt: { gte: monthStart } },
      orderBy: { receivedAt: "desc" },
      include: { client: { select: { name: true } } },
    }),
  ]);

  // The directories follow the filter chips: pick an offer and they narrow to it.
  const filteredOffers = clientFilter
    ? clientRows.filter((c) => c.id === clientFilter)
    : clientRows;

  // Remembered tools, offered when adding a login. Global, so the list is whatever has
  // ever been saved anywhere rather than a seed nobody maintains.
  const presets = context.canManage
    ? await prisma.loginPreset.findMany({
        orderBy: { service: "asc" },
        select: { service: true, url: true },
      })
    : [];

  // Only fetched for someone who may open them, and only for the offers on screen.
  const loginRows = context.canManage
    ? await prisma.credential.findMany({
        where: { clientId: { in: filteredOffers.map((c) => c.id) } },
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      })
    : [];

  const offers: OfferEntry[] = filteredOffers.map((offer) => ({
    id: offer.id,
    name: offer.name,
    slug: offer.slug,
    color: offer.color,
    assetsContent: offer.assetsContent,
    logins: loginRows
      .filter((l) => l.clientId === offer.id)
      .map((l) => ({
        id: l.id,
        service: l.service,
        url: l.url,
        identity: l.identity,
        notes: l.notes,
        hasSecret: l.secretCipher !== null,
      })),
  }));

  const clients: RowOption[] = clientRows.map((c) => ({
    value: c.id,
    label: c.name,
    color: c.color,
  }));
  const peopleOptions: RowOption[] = people.map((p) => ({
    value: p.id,
    label: p.name,
  }));

  const carryable = countCarryable(lastWeekTasks);
  const today = todayIndex(monday);
  const isCurrentWeek = monday.getTime() === thisMonday().getTime();

  // One flat list feeds the store; each panel selects from it. The same row can then
  // appear in the daily list and in its day on the week without the two drifting apart.
  const boardTasks: BoardTask[] = [...weekTasks, ...todos].map((task) => ({
    id: task.id,
    title: task.title,
    status: task.status,
    priority: task.priority,
    recurring: task.recurring,
    clientId: task.clientId,
    assigneeId: task.assigneeId,
    day: task.day,
    weekOf: task.weekOf ? weekParam(task.weekOf) : null,
    position: task.position,
  }));

  /* ------------------------------------------------------------- revenue -- */

  const monthDays = new Array<number>(daysInMonthUTC(now)).fill(0);
  for (const payment of monthPayments) {
    const dayIndex = payment.receivedAt.getUTCDate() - 1;
    if (dayIndex >= 0 && dayIndex < monthDays.length) {
      monthDays[dayIndex] += payment.amountCents;
    }
  }
  const todayPayments = monthPayments.filter(
    (p) => startOfDayUTC(p.receivedAt).getTime() === todayStart.getTime(),
  );
  const todayCents = todayPayments.reduce((sum, p) => sum + p.amountCents, 0);

  const href = (next: Partial<Search>) => {
    const query = new URLSearchParams();
    const merged = { week, client: clientFilter, person: personFilter, ...next };
    if (merged.week) query.set("week", merged.week);
    if (merged.client) query.set("client", merged.client);
    if (merged.person) query.set("person", merged.person);
    const string = query.toString();
    return string ? `/d/${slug}?${string}` : `/d/${slug}`;
  };

  const layout = parseBoardLayout(dashboard.boardLayout);

  return (
    <>
      <Nav session={session} dashboard={dashboard} context={context} />

      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-6">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[22px] font-bold tracking-tight">
              {isCurrentWeek ? "This week" : "Week of"}
            </h1>
            <p className="mt-0.5 text-[13px] text-ink-secondary tabular">
              {formatWeekRange(monday)}
            </p>
          </div>

          <div className="flex items-center gap-1">
            <Link
              href={href({ week: weekParam(addWeeks(monday, -1)) })}
              aria-label="Previous week"
              className={arrowClass}
            >
              ‹
            </Link>
            {!isCurrentWeek && (
              <Link
                href={href({ week: weekParam(thisMonday()) })}
                className={ghostButtonClass}
              >
                Today
              </Link>
            )}
            <Link
              href={href({ week: weekParam(addWeeks(monday, 1)) })}
              aria-label="Next week"
              className={arrowClass}
            >
              ›
            </Link>
          </div>
        </div>

        {/* Offers only. People used to be chips here too, which turned the top of the
            board into a staff list — the board is about the work, and who is on a task
            is already on its row. */}
        {clients.length > 0 && (
          <div className="scroll-x mb-5 flex items-center gap-1.5 pb-1">
            <FilterLink
              href={href({ client: "", person: "" })}
              active={!clientFilter && !personFilter}
            >
              Everything
            </FilterLink>
            {clients.map((client) => (
              <FilterLink
                key={client.value}
                href={href({
                  client: clientFilter === client.value ? "" : client.value,
                })}
                active={clientFilter === client.value}
              >
                {client.label}
              </FilterLink>
            ))}
          </div>
        )}

        <TaskStoreProvider
          tasks={boardTasks}
          dashboardSlug={slug}
          week={week}
          canManage={editable}
          canTick={context.canTick}
        >
        <BoardShell
          initialPanels={layout.panels}
          defaultPanels={DEFAULT_PANELS}
          onSave={saveBoardLayout.bind(null, slug)}
          editable={context.canManage}
          slots={{
            progress: (
              <>
                <DailyProgress today={today} />
                {editable && carryable > 0 && (
                  <form
                    action={carryOverLastWeek.bind(null, slug)}
                    className="mt-2"
                  >
                    <input type="hidden" name="week" value={week} />
                    <button type="submit" className={ghostButtonClass}>
                      Carry over {carryable} unfinished from last week
                    </button>
                  </form>
                )}
              </>
            ),

            revenue: (
              <RevenuePanel
                dashboardSlug={slug}
                todayCents={todayCents}
                goalCents={dashboard.revenueGoalCents}
                monthDays={monthDays}
                monthLabel={now.toLocaleDateString("en-GB", {
                  month: "long",
                  year: "numeric",
                  timeZone: "UTC",
                })}
                payments={todayPayments.map((p) => ({
                  id: p.id,
                  amountCents: p.amountCents,
                  note: p.note,
                  clientName: p.client?.name ?? null,
                  receivedAt: p.receivedAt.toISOString(),
                }))}
                clients={clientRows.map((c) => ({ id: c.id, name: c.name }))}
                editable={editable}
              />
            ),

            kpis: <KpiBoard kpis={kpis} editable={editable} dashboardSlug={slug} />,

            todo: (
              <DailyPanel
                today={today}
                clients={clients}
                people={peopleOptions}
                defaultClientId={clientFilter}
                defaultAssigneeId={personFilter}
              />
            ),

            week: (
              <div className="space-y-3">
                {DAYS.map((label, day) => {
                  const isToday = today === day;

                  return (
                    <div
                      key={label}
                      className={`overflow-hidden rounded-xl border bg-surface ${
                        isToday ? "border-accent-edge" : "border-subtle"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 px-3 py-2">
                        <div className="flex items-center gap-2">
                          <Chip color={dayTint(day)}>{label}</Chip>
                          <span className="text-[12px] text-ink-muted tabular">
                            {dateOfDay(monday, day).toLocaleDateString("en-GB", {
                              day: "numeric",
                              month: "short",
                              timeZone: "UTC",
                            })}
                          </span>
                          {isToday && (
                            <span className="text-[12px] font-semibold text-accent">
                              Today
                            </span>
                          )}
                        </div>

                      </div>

                      <TaskList
                        scope={{ kind: "day", day }}
                        clients={clients}
                        people={peopleOptions}
                        emptyNote="Nothing scheduled."
                        defaultClientId={clientFilter}
                        defaultAssigneeId={personFilter}
                      />
                    </div>
                  );
                })}
              </div>
            ),

            calls: (
              <CallsPanel
                calls={calls}
                dashboardSlug={slug}
                editable={editable}
              />
            ),

            assets: (
              <OfferDirectory
                offers={offers}
                kind="assets"
                dashboardSlug={slug}
                editable={editable}
              />
            ),

            logins: context.canManage ? (
              <OfferDirectory
                offers={offers}
                kind="logins"
                dashboardSlug={slug}
                editable={editable}
                presets={presets}
              />
            ) : (
              <p className="text-[13px] text-ink-muted">
                Open an offer to see its logins.
              </p>
            ),
          }}
        />
        </TaskStoreProvider>
      </main>
    </>
  );
}

function FilterLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={`shrink-0 rounded-full border px-2.5 py-1 text-[12px] font-semibold transition-colors ${
        active
          ? "border-accent-edge bg-accent-soft text-ink"
          : "border-subtle text-ink-secondary hover:border-strong hover:text-ink"
      }`}
    >
      {children}
    </Link>
  );
}

const arrowClass =
  "grid size-8 place-items-center rounded-full border border-subtle text-ink-secondary transition-colors hover:border-strong hover:text-ink";
