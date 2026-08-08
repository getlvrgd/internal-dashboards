import Link from "next/link";

import { carryOverLastWeek } from "@/app/actions/tasks";
import { AddTaskForm } from "@/components/AddTaskForm";
import { KpiBoard } from "@/components/KpiBoard";
import { Nav } from "@/components/Nav";
import { TaskRow, type RowOption } from "@/components/TaskRow";
import { Chip, EmptyNote, ghostButtonClass } from "@/components/ui";
import { resolveDashboard } from "@/lib/access";
import { prisma } from "@/lib/db";
import {
  DAYS,
  dayTint,
  TASK_STATUS,
  taskStatusTint,
} from "@/lib/options";
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
 * One week at a time, grouped by day, with the standing to-do list underneath. The week
 * is in the URL rather than in state, so a particular week is a link you can send
 * someone.
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
  const editable = context.canEdit;
  const params = await searchParams;

  const monday = parseWeekParam(params.week);
  const week = weekParam(monday);

  // Clones the standing routine the first time a week is opened. Safe to call on every
  // render — it does nothing once the week holds any task at all.
  await ensureWeek(dashboard.id, monday);

  const clientFilter = params.client ?? "";
  const personFilter = params.person ?? "";

  const [weekTasks, todos, clientRows, people, kpis, lastWeekTasks] =
    await Promise.all([
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
        select: { id: true, name: true, color: true },
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
    ]);

  const clients: RowOption[] = clientRows.map((c) => ({
    value: c.id,
    label: c.name,
    color: c.color,
  }));
  const peopleOptions: RowOption[] = people.map((p) => ({
    value: p.id,
    label: p.name,
  }));

  const done = weekTasks.filter((t) => t.status === TASK_STATUS.DONE).length;
  const blocked = weekTasks.filter(
    (t) => t.status === TASK_STATUS.BLOCKED,
  ).length;
  const carryable = countCarryable(lastWeekTasks);
  const today = todayIndex(monday);
  const isCurrentWeek = monday.getTime() === thisMonday().getTime();

  const href = (next: Partial<Search>) => {
    const query = new URLSearchParams();
    const merged = { week, client: clientFilter, person: personFilter, ...next };
    if (merged.week) query.set("week", merged.week);
    if (merged.client) query.set("client", merged.client);
    if (merged.person) query.set("person", merged.person);
    const string = query.toString();
    return string ? `/d/${slug}?${string}` : `/d/${slug}`;
  };

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

        <KpiBoard kpis={kpis} editable={editable} dashboardSlug={slug} />

        {/* Progress, then the two things worth acting on: what is stuck, and what did
            not get finished last week. */}
        <section className="mb-5 rounded-xl border border-subtle bg-surface px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[13px] font-semibold tabular">
              {done} of {weekTasks.length} done
              {blocked > 0 && (
                <span className="ml-2 font-semibold" style={{ color: "var(--status-critical)" }}>
                  · {blocked} blocked
                </span>
              )}
            </p>

            {editable && carryable > 0 && (
              <form action={carryOverLastWeek.bind(null, slug)}>
                <input type="hidden" name="week" value={week} />
                <button type="submit" className={ghostButtonClass}>
                  Carry over {carryable} unfinished from last week
                </button>
              </form>
            )}
          </div>

          <div
            className="mt-2.5 h-1.5 overflow-hidden rounded-full"
            style={{ background: "var(--border-subtle)" }}
            role="img"
            aria-label={`${done} of ${weekTasks.length} tasks done`}
          >
            <div
              className="h-full rounded-full transition-[width]"
              style={{
                width: `${weekTasks.length === 0 ? 0 : (done / weekTasks.length) * 100}%`,
                background: "var(--status-good)",
              }}
            />
          </div>
        </section>

        {/* Filters are links, not a form: they belong in the URL alongside the week, so
            "Chris's week" is one address. */}
        {(clients.length > 0 || peopleOptions.length > 1) && (
          <div className="scroll-x mb-4 flex items-center gap-1.5 pb-1">
            <FilterLink href={href({ client: "", person: "" })} active={!clientFilter && !personFilter}>
              Everything
            </FilterLink>
            {clients.map((client) => (
              <FilterLink
                key={client.value}
                href={href({ client: clientFilter === client.value ? "" : client.value })}
                active={clientFilter === client.value}
              >
                {client.label}
              </FilterLink>
            ))}
            {peopleOptions.length > 1 &&
              peopleOptions.map((person) => (
                <FilterLink
                  key={person.value}
                  href={href({ person: personFilter === person.value ? "" : person.value })}
                  active={personFilter === person.value}
                >
                  {person.label}
                </FilterLink>
              ))}
          </div>
        )}

        <div className="space-y-3">
          {DAYS.map((label, day) => {
            const rows = weekTasks.filter((task) => task.day === day);
            const isToday = today === day;

            return (
              <section
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
                  {rows.length > 0 && (
                    <span className="text-[12px] text-ink-muted tabular">
                      {rows.filter((t) => t.status === TASK_STATUS.DONE).length}/
                      {rows.length}
                    </span>
                  )}
                </div>

                <ul className="border-t border-subtle">
                  {rows.length === 0 && !editable && (
                    <li className="px-3">
                      <EmptyNote>Nothing scheduled.</EmptyNote>
                    </li>
                  )}
                  {rows.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      clients={clients}
                      people={peopleOptions}
                      editable={editable}
                      dashboardSlug={slug}
                    />
                  ))}
                  {editable && (
                    <li>
                      <AddTaskForm
                        day={day}
                        week={week}
                        clients={clients}
                        people={peopleOptions}
                        defaultClientId={clientFilter}
                        defaultAssigneeId={personFilter}
                        dashboardSlug={slug}
                      />
                    </li>
                  )}
                </ul>
              </section>
            );
          })}
        </div>

        {/* The to-do list. Deliberately outside the week: these are the things with no
            day yet, and they should not vanish when the week turns over. */}
        <section className="mt-6 overflow-hidden rounded-xl border border-subtle bg-surface">
          <div className="flex items-center justify-between gap-2 px-3 py-2">
            <h2 className="text-[13px] font-bold tracking-tight">To-do</h2>
            <span className="text-[12px] text-ink-muted">Not tied to a week</span>
          </div>

          <ul className="border-t border-subtle">
            {todos.length === 0 && !editable && (
              <li className="px-3">
                <EmptyNote>Nothing on the list.</EmptyNote>
              </li>
            )}
            {todos.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                clients={clients}
                people={peopleOptions}
                editable={editable}
                dashboardSlug={slug}
              />
            ))}
            {editable && (
              <li>
                <AddTaskForm
                  day={null}
                  week={week}
                  clients={clients}
                  people={peopleOptions}
                  defaultClientId={clientFilter}
                  defaultAssigneeId={personFilter}
                  dashboardSlug={slug}
                />
              </li>
            )}
          </ul>
        </section>

        <p className="mt-6 flex items-center gap-1.5 text-[12px] text-ink-muted">
          <span
            aria-hidden
            className="inline-block size-[7px] rounded-full"
            style={{ background: taskStatusTint(TASK_STATUS.BLOCKED) }}
          />
          Set a task to “Blocked” when it is waiting on someone — blocked counts show
          at the top of the week.
        </p>
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
