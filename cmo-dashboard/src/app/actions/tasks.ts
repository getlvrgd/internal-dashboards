"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireDashboardTick, requireDashboardWrite } from "@/lib/access";
import { prisma } from "@/lib/db";
import {
  ALL_PRIORITIES,
  ALL_TASK_STATUSES,
  TASK_STATUS,
} from "@/lib/options";
import { addWeeks, carryOver, parseWeekParam } from "@/lib/week";

/**
 * Every write to the weekly board and the to-do list.
 *
 * All of them call requireDashboardWrite() first — a viewer's session, or a member of a
 * different dashboard, must not be able to reach a mutation by posting the form
 * directly, and the page-level guard says nothing about that.
 *
 * Every row is then re-read scoped to the resolved dashboard before it is touched. The
 * id in the form is user input; `where: { id }` alone would let a member of one
 * dashboard edit another's board by posting its task id.
 */

/** Empty strings arrive from unfilled <select> and <input> fields; treat them as unset. */
const optionalId = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable();

const createSchema = z.object({
  title: z.string().trim().min(1, "A task needs a title.").max(200),
  day: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : Number(v)))
    .nullable()
    .refine((v) => v === null || (Number.isInteger(v) && v >= 0 && v <= 6), {
      message: "Not a day of the week.",
    }),
  week: z.string().trim().optional(),
  clientId: optionalId,
  assigneeId: optionalId,
  priority: z.enum(ALL_PRIORITIES as [string, ...string[]]).catch("NORMAL"),
  recurring: z
    .string()
    .nullable()
    .transform((v) => v === "on" || v === "true"),
});

/** A task id, but only if it lives in this dashboard. */
async function ownedTask<T extends Record<string, boolean>>(
  id: string,
  dashboardId: string,
  select: T,
) {
  if (!id) return null;
  return prisma.task.findFirst({
    where: { id, dashboardId },
    select: { id: true, ...select },
  });
}

/**
 * A client or assignee posted with a task, verified before it is stored.
 *
 * Without this a crafted form could file a task against a client in someone else's
 * dashboard, which would then show up on their board.
 */
async function safeClientId(clientId: string | null, dashboardId: string) {
  if (!clientId) return null;
  const client = await prisma.client.findFirst({
    where: { id: clientId, dashboardId },
    select: { id: true },
  });
  return client?.id ?? null;
}

async function safeAssigneeId(assigneeId: string | null, dashboardId: string) {
  if (!assigneeId) return null;
  const user = await prisma.user.findFirst({
    where: {
      id: assigneeId,
      isActive: true,
      // Assignable people are those who can actually open the dashboard: its members,
      // plus every admin and the owner, who reach it by platform role.
      OR: [
        { memberships: { some: { dashboardId } } },
        { role: { in: ["OWNER", "ADMIN"] } },
      ],
    },
    select: { id: true },
  });
  return user?.id ?? null;
}

export type CreateTaskResult = { ok: boolean };

export async function createTask(
  dashboardSlug: string,
  formData: FormData,
): Promise<CreateTaskResult> {
  const { dashboard } = await requireDashboardWrite(dashboardSlug);

  const parsed = createSchema.safeParse({
    title: formData.get("title"),
    day: formData.get("day") ?? "",
    week: formData.get("week") ?? undefined,
    clientId: formData.get("clientId") ?? "",
    assigneeId: formData.get("assigneeId") ?? "",
    priority: formData.get("priority") ?? "NORMAL",
    recurring: formData.get("recurring"),
  });
  // A blank title is the only realistic failure and the input is `required`. The caller
  // is told rather than left guessing: AddTaskForm clears the field optimistically, so
  // a silent failure would look like the task was accepted and then vanished.
  if (!parsed.success) return { ok: false };

  const { title, day, week, clientId, assigneeId, priority, recurring } =
    parsed.data;

  // A task with no day is a to-do: it belongs to no week and stays until it is ticked.
  const weekOf = day === null ? null : parseWeekParam(week);

  // New rows land at the bottom of their day rather than the top — the board reads as a
  // list you add to, and a task appearing above ones already there loses your place.
  const last = await prisma.task.findFirst({
    where: { dashboardId: dashboard.id, weekOf, day },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  await prisma.task.create({
    data: {
      dashboardId: dashboard.id,
      title,
      day,
      weekOf,
      clientId: await safeClientId(clientId, dashboard.id),
      assigneeId: await safeAssigneeId(assigneeId, dashboard.id),
      priority,
      recurring: day === null ? false : recurring,
      position: (last?.position ?? -1) + 1,
    },
  });

  revalidatePath(`/d/${dashboardSlug}`);
  return { ok: true };
}

/**
 * The tick box on each row.
 *
 * Ticking something off is far and away the most common thing anyone does here, so it
 * gets a one-tap control of its own rather than a trip through the status menu. The menu
 * still owns the other three states — this only moves a row in and out of DONE.
 *
 * Un-ticking returns the task to "not started" rather than to whatever it was before:
 * storing a previous-status column to restore would be a lot of machinery for a case
 * that is almost always a misclick.
 *
 * Plain arguments rather than FormData: the board applies every change optimistically
 * before the round trip, so these are called from a transition in the client rather
 * than posted by a form.
 */
export async function setTaskDone(
  dashboardSlug: string,
  id: string,
  done: boolean,
) {
  // The one write a member has. Everything else on the board is manager-only.
  const { dashboard } = await requireDashboardTick(dashboardSlug);

  const task = await ownedTask(id, dashboard.id, {});
  if (!task) return;

  await prisma.task.update({
    where: { id: task.id },
    data: {
      status: done ? TASK_STATUS.DONE : TASK_STATUS.NOT_STARTED,
      completedAt: done ? new Date() : null,
    },
  });

  revalidatePath(`/d/${dashboardSlug}`);
}

export async function setTaskRecurring(
  dashboardSlug: string,
  id: string,
  recurring: boolean,
) {
  const { dashboard } = await requireDashboardWrite(dashboardSlug);

  const task = await ownedTask(id, dashboard.id, { weekOf: true });
  // A task with no week has nothing to recur into, so the flag is meaningless there.
  if (!task || task.weekOf === null) return;

  await prisma.task.update({
    where: { id: task.id },
    data: { recurring },
  });

  revalidatePath(`/d/${dashboardSlug}`);
}

export async function removeTask(dashboardSlug: string, id: string) {
  const { dashboard } = await requireDashboardWrite(dashboardSlug);

  const task = await ownedTask(id, dashboard.id, {});
  if (!task) return;

  await prisma.task.delete({ where: { id: task.id } });
  revalidatePath(`/d/${dashboardSlug}`);
}

/** One field at a time, as the row's controls change them. */
export async function patchTask(
  dashboardSlug: string,
  id: string,
  patch: {
    title?: string;
    status?: string;
    priority?: string;
    clientId?: string | null;
    assigneeId?: string | null;
  },
) {
  const { dashboard } = await requireDashboardWrite(dashboardSlug);

  const task = await ownedTask(id, dashboard.id, {});
  if (!task) return;

  const data: Record<string, unknown> = {};

  if (patch.title !== undefined) {
    const title = patch.title.trim().slice(0, 200);
    if (!title) return;
    data.title = title;
  }
  if (patch.status !== undefined) {
    if (!ALL_TASK_STATUSES.includes(patch.status)) return;
    data.status = patch.status;
    // completedAt is derived, never posted: set the moment a task turns DONE and
    // cleared if it is reopened, so "finished this week" needs no separate event log.
    data.completedAt = patch.status === TASK_STATUS.DONE ? new Date() : null;
  }
  if (patch.priority !== undefined) {
    if (!ALL_PRIORITIES.includes(patch.priority)) return;
    data.priority = patch.priority;
  }
  if (patch.clientId !== undefined) {
    data.clientId = await safeClientId(patch.clientId, dashboard.id);
  }
  if (patch.assigneeId !== undefined) {
    data.assigneeId = await safeAssigneeId(patch.assigneeId, dashboard.id);
  }

  if (Object.keys(data).length === 0) return;

  await prisma.task.update({ where: { id: task.id }, data });
  revalidatePath(`/d/${dashboardSlug}`);
}

/**
 * Drops a task into a day, at a position.
 *
 * `day` of null moves it to the to-do list, which also clears its week — a to-do is
 * defined by having no day, and leaving `weekOf` set would make it reappear on the
 * board the moment someone gave it a day again.
 *
 * Positions in the destination are rewritten rather than nudged: rows created before
 * ordering mattered all sit at 0, and inserting into a block of ties moves nothing.
 */
export async function moveTask(
  dashboardSlug: string,
  taskId: string,
  day: number | null,
  index: number,
  week: string,
) {
  const { dashboard } = await requireDashboardWrite(dashboardSlug);

  const task = await ownedTask(taskId, dashboard.id, { day: true });
  if (!task) return;
  if (day !== null && (!Number.isInteger(day) || day < 0 || day > 6)) return;

  const weekOf = day === null ? null : parseWeekParam(week);

  const siblings = await prisma.task.findMany({
    where: { dashboardId: dashboard.id, weekOf, day, id: { not: task.id } },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    select: { id: true },
  });

  const at = Math.max(0, Math.min(index, siblings.length));
  const ordered = [
    ...siblings.slice(0, at).map((s) => s.id),
    task.id,
    ...siblings.slice(at).map((s) => s.id),
  ];

  await prisma.$transaction([
    prisma.task.update({
      where: { id: task.id },
      data: { day, weekOf, recurring: day === null ? false : undefined },
    }),
    ...ordered.map((id, position) =>
      prisma.task.update({ where: { id }, data: { position } }),
    ),
  ]);

  revalidatePath(`/d/${dashboardSlug}`);
}

/**
 * Sweeps last week's unfinished one-offs into the week on screen.
 *
 * Deliberately a button rather than something ensureWeek() does on its own: silently
 * moving rows between weeks would make a past week's board misreport what happened in it.
 */
export async function carryOverLastWeek(
  dashboardSlug: string,
  formData: FormData,
) {
  const { dashboard } = await requireDashboardWrite(dashboardSlug);

  const to = parseWeekParam(String(formData.get("week") ?? ""));
  await carryOver(dashboard.id, addWeeks(to, -1), to);

  revalidatePath(`/d/${dashboardSlug}`);
}
