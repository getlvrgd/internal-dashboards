"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireDashboardWrite } from "@/lib/access";
import { prisma } from "@/lib/db";
import {
  ALL_CLIENT_STATUSES,
  isTileColor,
  slugify,
  TILE_COLORS,
  uniqueSlug,
} from "@/lib/options";

/** [{ label, url }] — the quick links on a client card. */
const linkSchema = z.array(
  z.object({ label: z.string().trim().max(60), url: z.string().trim().max(500) }),
);

/**
 * Links arrive as parallel `linkLabel`/`linkUrl` field arrays. Rows with neither a label
 * nor a URL are dropped, which is what lets the form always render one spare blank row.
 */
function readLinks(formData: FormData) {
  const labels = formData.getAll("linkLabel").map(String);
  const urls = formData.getAll("linkUrl").map(String);
  const rows = labels
    .map((label, i) => ({ label: label.trim(), url: (urls[i] ?? "").trim() }))
    .filter((row) => row.label !== "" || row.url !== "");
  const parsed = linkSchema.safeParse(rows);
  return parsed.success ? parsed.data : [];
}

const clientSchema = z.object({
  name: z.string().trim().min(1, "A client needs a name.").max(120),
  offerOwner: z.string().trim().max(120),
  niche: z.string().trim().max(120),
  status: z.enum(ALL_CLIENT_STATUSES as [string, ...string[]]).catch("ONBOARDING"),
  color: z
    .string()
    .trim()
    .refine(isTileColor, { message: "Not a colour." })
    .catch(TILE_COLORS[0].value),
  notes: z.string().trim().max(4000),
});

function readClient(formData: FormData) {
  return clientSchema.safeParse({
    name: formData.get("name") ?? "",
    offerOwner: formData.get("offerOwner") ?? "",
    niche: formData.get("niche") ?? "",
    status: formData.get("status") ?? "ONBOARDING",
    color: formData.get("color") ?? "",
    notes: formData.get("notes") ?? "",
  });
}

/**
 * A slug nothing else in the same dashboard is using.
 *
 * Uniqueness is per dashboard, not global — two dashboards may each run a client called
 * "Acme", and making the second one `acme-2` because a different team already had one
 * would be a collision the user cannot see the cause of.
 */
async function slugFor(dashboardId: string, name: string, exceptId?: string) {
  const siblings = await prisma.client.findMany({
    where: { dashboardId, ...(exceptId ? { id: { not: exceptId } } : {}) },
    select: { slug: true },
  });
  return uniqueSlug(
    slugify(name, "client"),
    siblings.map((s) => s.slug),
  );
}

export async function createClient(dashboardSlug: string, formData: FormData) {
  const { dashboard } = await requireDashboardWrite(dashboardSlug);

  const parsed = readClient(formData);
  if (!parsed.success) return;

  const last = await prisma.client.findFirst({
    where: { dashboardId: dashboard.id },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  const client = await prisma.client.create({
    data: {
      ...parsed.data,
      dashboardId: dashboard.id,
      offerOwner: parsed.data.offerOwner || null,
      niche: parsed.data.niche || null,
      notes: parsed.data.notes || null,
      slug: await slugFor(dashboard.id, parsed.data.name),
      links: readLinks(formData),
      position: (last?.position ?? -1) + 1,
    },
  });

  revalidatePath(`/d/${dashboardSlug}/clients`);
  redirect(`/d/${dashboardSlug}/clients/${client.slug}`);
}

export async function updateClient(dashboardSlug: string, formData: FormData) {
  const { dashboard } = await requireDashboardWrite(dashboardSlug);

  // Scoped by dashboardId as well as id: the id came from the form, so on its own it
  // would let someone edit a client belonging to a dashboard they cannot open.
  const existing = await prisma.client.findFirst({
    where: { id: String(formData.get("id") ?? ""), dashboardId: dashboard.id },
    select: { id: true },
  });
  if (!existing) return;

  const parsed = readClient(formData);
  if (!parsed.success) return;

  const client = await prisma.client.update({
    where: { id: existing.id },
    data: {
      ...parsed.data,
      offerOwner: parsed.data.offerOwner || null,
      niche: parsed.data.niche || null,
      notes: parsed.data.notes || null,
      slug: await slugFor(dashboard.id, parsed.data.name, existing.id),
      links: readLinks(formData),
    },
  });

  revalidatePath(`/d/${dashboardSlug}/clients`);
  redirect(`/d/${dashboardSlug}/clients/${client.slug}`);
}

/**
 * Deleting a client takes its logins with it (cascade) but leaves its tasks, which fall
 * back to unassigned — a week's history should not lose rows because a client left.
 */
export async function deleteClient(dashboardSlug: string, formData: FormData) {
  const { dashboard } = await requireDashboardWrite(dashboardSlug);

  const existing = await prisma.client.findFirst({
    where: { id: String(formData.get("id") ?? ""), dashboardId: dashboard.id },
    select: { id: true },
  });
  if (!existing) return;

  await prisma.client.delete({ where: { id: existing.id } });

  revalidatePath(`/d/${dashboardSlug}/clients`);
  revalidatePath(`/d/${dashboardSlug}`);
  redirect(`/d/${dashboardSlug}/clients`);
}
