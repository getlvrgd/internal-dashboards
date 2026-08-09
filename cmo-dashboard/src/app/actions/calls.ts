"use server";

import { revalidatePath } from "next/cache";

import { requireDashboardWrite } from "@/lib/access";
import { prisma } from "@/lib/db";

/**
 * The standing calls panel.
 *
 * A call is a title, when it happens and a link to join. `time` is free text on purpose:
 * "Every weekday at 9:00am" is what someone actually wants to read, and modelling a
 * recurrence rule would mean a scheduler, a timezone per person and a UI for all of it,
 * to render a sentence.
 */

const read = (formData: FormData) => ({
  title: String(formData.get("title") ?? "").trim().slice(0, 120),
  url: String(formData.get("url") ?? "").trim().slice(0, 500) || null,
  time: String(formData.get("time") ?? "").trim().slice(0, 120) || null,
  notes: String(formData.get("notes") ?? "").trim().slice(0, 500) || null,
});

export async function createCall(dashboardSlug: string, formData: FormData) {
  const { dashboard } = await requireDashboardWrite(dashboardSlug);

  const data = read(formData);
  if (!data.title) return;

  const last = await prisma.call.findFirst({
    where: { dashboardId: dashboard.id },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  await prisma.call.create({
    data: {
      ...data,
      dashboardId: dashboard.id,
      position: (last?.position ?? -1) + 1,
    },
  });

  revalidatePath(`/d/${dashboardSlug}`);
}

export async function updateCall(dashboardSlug: string, formData: FormData) {
  const { dashboard } = await requireDashboardWrite(dashboardSlug);

  const existing = await prisma.call.findFirst({
    where: { id: String(formData.get("id") ?? ""), dashboardId: dashboard.id },
    select: { id: true },
  });
  if (!existing) return;

  const data = read(formData);
  if (!data.title) return;

  await prisma.call.update({ where: { id: existing.id }, data });
  revalidatePath(`/d/${dashboardSlug}`);
}

export async function deleteCall(dashboardSlug: string, formData: FormData) {
  const { dashboard } = await requireDashboardWrite(dashboardSlug);

  const existing = await prisma.call.findFirst({
    where: { id: String(formData.get("id") ?? ""), dashboardId: dashboard.id },
    select: { id: true },
  });
  if (!existing) return;

  await prisma.call.delete({ where: { id: existing.id } });
  revalidatePath(`/d/${dashboardSlug}`);
}

/** Manual ordering, same rewrite-every-position approach the hub uses. */
export async function moveCall(
  dashboardSlug: string,
  direction: "up" | "down",
  formData: FormData,
) {
  const { dashboard } = await requireDashboardWrite(dashboardSlug);

  const all = await prisma.call.findMany({
    where: { dashboardId: dashboard.id },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    select: { id: true },
  });
  const index = all.findIndex((c) => c.id === String(formData.get("id") ?? ""));
  if (index === -1) return;

  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= all.length) return;

  const reordered = [...all];
  [reordered[index], reordered[target]] = [reordered[target], reordered[index]];

  await prisma.$transaction(
    reordered.map((c, position) =>
      prisma.call.update({ where: { id: c.id }, data: { position } }),
    ),
  );

  revalidatePath(`/d/${dashboardSlug}`);
}
