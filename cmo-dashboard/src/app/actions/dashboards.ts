"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireAdmin, requireDashboardManager, requireOwner } from "@/lib/access";
import { prisma } from "@/lib/db";
import {
  ALL_DASHBOARD_STATUSES,
  DASHBOARD_STATUS,
  isTileColor,
  slugify,
  uniqueSlug,
} from "@/lib/options";
import { createDashboardWithContent, takenDashboardSlugs } from "@/lib/seed";

/**
 * Creating, renaming and retiring dashboards.
 *
 * Every write here is admin-only except deletion, which is the owner's alone — a
 * dashboard holds a team's whole year of work, and an admin having the same button as
 * the person who owns the business is not a trade worth making.
 */

const createSchema = z.object({
  name: z.string().trim().min(1, "Give it a name.").max(80),
  description: z.string().trim().max(240).optional(),
  color: z.string().optional(),
  copyFromId: z.string().trim().optional(),
});

export type DashboardFormState = { error?: string };

export async function createDashboard(
  _previous: DashboardFormState,
  formData: FormData,
): Promise<DashboardFormState> {
  await requireAdmin();

  const parsed = createSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") ?? undefined,
    color: formData.get("color") ?? undefined,
    copyFromId: formData.get("copyFromId") ?? undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the details." };
  }

  // "Start from scratch" posts an empty value; anything else has to be a real row, and
  // createDashboardWithContent falls back to the starter library if it is not.
  const copyFromId = parsed.data.copyFromId || null;

  const dashboard = await createDashboardWithContent({
    name: parsed.data.name,
    description: parsed.data.description ?? null,
    color: isTileColor(parsed.data.color) ? parsed.data.color : "blue",
    copyFromId,
  });

  revalidatePath("/hub");
  redirect(`/d/${dashboard.slug}`);
}

const settingsSchema = z.object({
  name: z.string().trim().min(1, "Give it a name.").max(80),
  description: z.string().trim().max(240).optional(),
  status: z.string().refine((v) => ALL_DASHBOARD_STATUSES.includes(v)),
  color: z.string().optional(),
});

export async function updateDashboard(slug: string, formData: FormData) {
  const { dashboard } = await requireDashboardManager(slug);

  const parsed = settingsSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") ?? undefined,
    status: formData.get("status"),
    color: formData.get("color") ?? undefined,
  });
  if (!parsed.success) return;

  // The slug follows the name, but only while nobody is linking to the old one yet —
  // a live dashboard keeps its address, because bookmarks and pasted links are the
  // whole point of it having one.
  let nextSlug = dashboard.slug;
  if (
    dashboard.status === DASHBOARD_STATUS.DRAFT &&
    slugify(parsed.data.name, "dashboard") !== dashboard.slug
  ) {
    const taken = (await takenDashboardSlugs()).filter(
      (s) => s !== dashboard.slug,
    );
    nextSlug = uniqueSlug(slugify(parsed.data.name, "dashboard"), taken);
  }

  await prisma.dashboard.update({
    where: { id: dashboard.id },
    data: {
      name: parsed.data.name,
      description: parsed.data.description?.trim() || null,
      status: parsed.data.status,
      color: isTileColor(parsed.data.color) ? parsed.data.color : undefined,
      slug: nextSlug,
    },
  });

  revalidatePath("/hub");
  revalidatePath(`/d/${nextSlug}`, "layout");

  // Editing from the hub stays on the hub. The redirect below exists only because the
  // settings page lives at the address that just changed, so leaving someone on it
  // would show them a URL that no longer resolves.
  if (formData.get("from") === "hub") return;
  if (nextSlug !== dashboard.slug) redirect(`/d/${nextSlug}/settings`);
}

/**
 * Marks the dashboard new ones are cloned from.
 *
 * Exactly one row carries the flag, so setting it clears it everywhere else in the same
 * transaction — two templates would make "create a dashboard" ambiguous, and the bug
 * would only show up the next time someone used it.
 */
export async function setTemplate(slug: string) {
  const { dashboard } = await requireDashboardManager(slug);

  await prisma.$transaction([
    prisma.dashboard.updateMany({
      where: { isTemplate: true },
      data: { isTemplate: false },
    }),
    prisma.dashboard.update({
      where: { id: dashboard.id },
      data: { isTemplate: true },
    }),
  ]);

  revalidatePath("/hub");
  revalidatePath(`/d/${slug}/settings`);
}

/** Manual ordering on the owner hub. */
export async function moveDashboard(slug: string, direction: "up" | "down") {
  await requireAdmin();

  const all = await prisma.dashboard.findMany({
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    select: { id: true, slug: true },
  });
  const index = all.findIndex((d) => d.slug === slug);
  if (index === -1) return;

  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= all.length) return;

  const reordered = [...all];
  [reordered[index], reordered[target]] = [reordered[target], reordered[index]];

  // Rewrite every position rather than swapping two: rows created before ordering
  // existed all sit at 0, and swapping within a block of ties moves nothing.
  await prisma.$transaction(
    reordered.map((d, position) =>
      prisma.dashboard.update({ where: { id: d.id }, data: { position } }),
    ),
  );

  revalidatePath("/hub");
}

/**
 * Deletes a dashboard and everything inside it. Owner only, and irreversible: the
 * cascades in the schema take its clients, tasks, KPIs, logins and grants with it.
 */
export async function deleteDashboard(slug: string) {
  await requireOwner();

  const dashboard = await prisma.dashboard.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!dashboard) redirect("/hub");

  await prisma.dashboard.delete({ where: { id: dashboard.id } });

  revalidatePath("/hub");
  redirect("/hub");
}
