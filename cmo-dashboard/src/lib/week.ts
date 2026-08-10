import "server-only";

import { prisma } from "./db";
import { TASK_STATUS } from "./options";

/**
 * Week arithmetic and the one place a new week's rows come from.
 *
 * Every date here is UTC midnight. Weeks are identified by their Monday, and a task's
 * `weekOf` is always exactly that — so "which week is this task in" is a equality check
 * rather than a range scan, and a user in a different timezone sees the same board.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** The Monday of the week containing `date`, at UTC midnight. */
export function mondayOf(date: Date): Date {
  const utc = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  // getUTCDay is Sunday-first (0=Sun); the board is Monday-first, so shift before
  // taking the remainder.
  const offset = (utc.getUTCDay() + 6) % 7;
  return new Date(utc.getTime() - offset * DAY_MS);
}

export const thisMonday = () => mondayOf(new Date());

export const addWeeks = (monday: Date, count: number) =>
  new Date(monday.getTime() + count * 7 * DAY_MS);

/** The date of a given day slot (0 = Monday) within a week. */
export const dateOfDay = (monday: Date, day: number) =>
  new Date(monday.getTime() + day * DAY_MS);

/** `2026-08-03`, the form used in the ?week= query parameter. */
export const weekParam = (monday: Date) => monday.toISOString().slice(0, 10);

/**
 * Reads a ?week= value back. Anything unparseable falls back to the current week
 * rather than erroring — a mangled URL should not be a dead end.
 */
export function parseWeekParam(value: string | undefined): Date {
  if (!value) return thisMonday();
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return thisMonday();
  return mondayOf(parsed);
}

/** "3 – 9 Aug 2026", collapsing the month and year when both ends share them. */
export function formatWeekRange(monday: Date) {
  const sunday = new Date(monday.getTime() + 6 * DAY_MS);
  const day = (d: Date) => d.getUTCDate();
  const month = (d: Date) =>
    d.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" });
  const year = (d: Date) => d.getUTCFullYear();

  const sameMonth = monday.getUTCMonth() === sunday.getUTCMonth();
  const sameYear = year(monday) === year(sunday);

  if (sameMonth && sameYear) {
    return `${day(monday)} – ${day(sunday)} ${month(sunday)} ${year(sunday)}`;
  }
  if (sameYear) {
    return `${day(monday)} ${month(monday)} – ${day(sunday)} ${month(sunday)} ${year(sunday)}`;
  }
  return `${day(monday)} ${month(monday)} ${year(monday)} – ${day(sunday)} ${month(sunday)} ${year(sunday)}`;
}

/** Which day slot today falls in, or null when the week on screen is not this one. */
export function todayIndex(monday: Date): number | null {
  const today = mondayOf(new Date());
  if (today.getTime() !== monday.getTime()) return null;
  return (new Date().getUTCDay() + 6) % 7;
}

/**
 * Materialises a week by cloning the standing routine into it.
 *
 * Runs whenever a week is opened, and is safe to call repeatedly: a series already
 * present in the week is skipped, so nothing stacks up.
 *
 * Only recurring tasks are cloned. Unfinished one-off tasks are deliberately NOT swept
 * forward here: moving someone's rows between weeks behind their back makes last week's
 * board a lie. The UI offers that as one explicit click instead — see carryOver().
 */
export async function ensureWeek(dashboardId: string, monday: Date) {
  // Every standing series, newest instance first. Deliberately not "last week only":
  // a week nobody opened used to break the chain forever, because the clone had nothing
  // to copy from and the routine was gone for good.
  const history = await prisma.task.findMany({
    where: { dashboardId, recurring: true, weekOf: { lt: monday } },
    orderBy: [{ weekOf: "desc" }, { position: "asc" }],
  });
  if (history.length === 0) return;

  const latest = new Map<string, (typeof history)[number]>();
  for (const task of history) {
    const series = task.seriesId ?? task.id;
    if (!latest.has(series)) latest.set(series, task);
  }

  // What this week already has. Checked per series rather than "does the week hold any
  // task at all" — adding one one-off used to stop the whole routine appearing.
  const present = await prisma.task.findMany({
    where: { dashboardId, weekOf: monday },
    select: { seriesId: true },
  });
  for (const row of present) {
    if (row.seriesId) latest.delete(row.seriesId);
  }

  if (latest.size === 0) return;

  await prisma.task.createMany({
    data: [...latest.values()].map((task) => ({
      dashboardId,
      title: task.title,
      notes: task.notes,
      day: task.day,
      weekOf: monday,
      clientId: task.clientId,
      assigneeId: task.assigneeId,
      priority: task.priority,
      recurring: true,
      seriesId: task.seriesId ?? task.id,
      position: task.position,
      // A cloned routine task starts fresh — status and completion do not travel.
      status: TASK_STATUS.NOT_STARTED,
    })),
  });
}

/**
 * Moves every unfinished task out of `from` and into `to`.
 *
 * Moves rather than copies: the task is the same piece of work, it simply did not get
 * done. Recurring tasks are excluded — the next week already has its own clone of those,
 * and dragging the old one along would double them up.
 */
export async function carryOver(dashboardId: string, from: Date, to: Date) {
  const { count } = await prisma.task.updateMany({
    where: {
      dashboardId,
      weekOf: from,
      recurring: false,
      status: { not: TASK_STATUS.DONE },
    },
    data: { weekOf: to },
  });
  return count;
}

/** How many rows the carry-over button would move, for its label. */
export function countCarryable(
  tasks: { recurring: boolean; status: string }[],
) {
  return tasks.filter((t) => !t.recurring && t.status !== TASK_STATUS.DONE)
    .length;
}
