"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireEditor } from "@/lib/access";
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
 * All of them call requireEditor() first — a viewer's session must not be able to reach
 * a mutation by posting the form directly, and the page-level guard says nothing about
 * that.
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

export async function createTask(formData: FormData) {
  await requireEditor();

  const parsed = createSchema.safeParse({
    title: formData.get("title"),
    day: formData.get("day") ?? "",
    week: formData.get("week") ?? undefined,
    clientId: formData.get("clientId") ?? "",
    assigneeId: formData.get("assigneeId") ?? "",
    priority: formData.get("priority") ?? "NORMAL",
    recurring: formData.get("recurring"),
  });
  // A blank title is the only realistic failure and the input is `required`; dropping
  // it silently beats throwing an error page over a stray submit.
  if (!parsed.success) return;

  const { title, day, week, clientId, assigneeId, priority, recurring } =
    parsed.data;

  // A task with no day is a to-do: it belongs to no week and stays until it is ticked.
  const weekOf = day === null ? null : parseWeekParam(week);

  // New rows land at the bottom of their day rather than the top — the board reads as a
  // list you add to, and a task appearing above ones already there loses your place.
  const last = await prisma.task.findFirst({
    where: { weekOf, day },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  await prisma.task.create({
    data: {
      title,
      day,
      weekOf,
      clientId,
      assigneeId,
      priority,
      recurring: day === null ? false : recurring,
      position: (last?.position ?? -1) + 1,
    },
  });

  revalidatePath("/");
}

const updateSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1).max(200).optional(),
  notes: z.string().trim().max(2000).optional(),
  status: z.enum(ALL_TASK_STATUSES as [string, ...string[]]).optional(),
  priority: z.enum(ALL_PRIORITIES as [string, ...string[]]).optional(),
  clientId: optionalId.optional(),
  assigneeId: optionalId.optional(),
  day: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : Number(v)))
    .nullable()
    .refine((v) => v === null || (Number.isInteger(v) && v >= 0 && v <= 6))
    .optional(),
});

/**
 * One updater for every field, so the row's controls can each post just what they
 * changed. Only keys actually present in the form are written.
 */
export async function updateTask(formData: FormData) {
  await requireEditor();

  const raw: Record<string, unknown> = { id: formData.get("id") };
  for (const key of [
    "title",
    "notes",
    "status",
    "priority",
    "clientId",
    "assigneeId",
    "day",
  ]) {
    if (formData.has(key)) raw[key] = formData.get(key);
  }

  const parsed = updateSchema.safeParse(raw);
  if (!parsed.success) return;

  const { id, ...changes } = parsed.data;

  await prisma.task.update({
    where: { id },
    data: {
      ...changes,
      // completedAt is derived, never posted: it is set the moment a task turns DONE and
      // cleared if it is reopened, so "finished this week" needs no separate event log.
      ...(changes.status === undefined
        ? {}
        : {
            completedAt:
              changes.status === TASK_STATUS.DONE ? new Date() : null,
          }),
    },
  });

  revalidatePath("/");
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
 */
export async function toggleDone(formData: FormData) {
  await requireEditor();

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const task = await prisma.task.findUnique({
    where: { id },
    select: { status: true },
  });
  if (!task) return;

  const done = task.status === TASK_STATUS.DONE;

  await prisma.task.update({
    where: { id },
    data: {
      status: done ? TASK_STATUS.NOT_STARTED : TASK_STATUS.DONE,
      completedAt: done ? null : new Date(),
    },
  });

  revalidatePath("/");
}

export async function toggleRecurring(formData: FormData) {
  await requireEditor();

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const task = await prisma.task.findUnique({
    where: { id },
    select: { recurring: true, weekOf: true },
  });
  // A to-do has no week to recur into, so the flag is meaningless there.
  if (!task || task.weekOf === null) return;

  await prisma.task.update({
    where: { id },
    data: { recurring: !task.recurring },
  });

  revalidatePath("/");
}

export async function deleteTask(formData: FormData) {
  await requireEditor();

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await prisma.task.delete({ where: { id } });
  revalidatePath("/");
}

/**
 * Sweeps last week's unfinished one-offs into the week on screen.
 *
 * Deliberately a button rather than something ensureWeek() does on its own: silently
 * moving rows between weeks would make a past week's board misreport what happened in it.
 */
export async function carryOverLastWeek(formData: FormData) {
  await requireEditor();

  const to = parseWeekParam(String(formData.get("week") ?? ""));
  await carryOver(addWeeks(to, -1), to);

  revalidatePath("/");
}
