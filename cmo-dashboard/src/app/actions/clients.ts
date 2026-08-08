"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireEditor } from "@/lib/access";
import { prisma } from "@/lib/db";
import {
  ALL_CLIENT_STATUSES,
  isTileColor,
  slugify,
  TILE_COLORS,
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
 * Finds a slug nothing else is using. `slug` is unique in the schema, so two clients
 * called "Acme" would otherwise collide — the second becomes `acme-2`.
 */
async function uniqueSlug(name: string, exceptId?: string) {
  const base = slugify(name);
  for (let suffix = 0; ; suffix += 1) {
    const candidate = suffix === 0 ? base : `${base}-${suffix + 1}`;
    const clash = await prisma.client.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!clash || clash.id === exceptId) return candidate;
  }
}

export async function createClient(formData: FormData) {
  await requireEditor();

  const parsed = readClient(formData);
  if (!parsed.success) return;

  const last = await prisma.client.findFirst({
    orderBy: { position: "desc" },
    select: { position: true },
  });

  const client = await prisma.client.create({
    data: {
      ...parsed.data,
      offerOwner: parsed.data.offerOwner || null,
      niche: parsed.data.niche || null,
      notes: parsed.data.notes || null,
      slug: await uniqueSlug(parsed.data.name),
      links: readLinks(formData),
      position: (last?.position ?? -1) + 1,
    },
  });

  revalidatePath("/clients");
  redirect(`/clients/${client.slug}`);
}

export async function updateClient(formData: FormData) {
  await requireEditor();

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const parsed = readClient(formData);
  if (!parsed.success) return;

  const client = await prisma.client.update({
    where: { id },
    data: {
      ...parsed.data,
      offerOwner: parsed.data.offerOwner || null,
      niche: parsed.data.niche || null,
      notes: parsed.data.notes || null,
      slug: await uniqueSlug(parsed.data.name, id),
      links: readLinks(formData),
    },
  });

  revalidatePath("/clients");
  redirect(`/clients/${client.slug}`);
}

/**
 * Deleting a client takes its credentials with it (cascade) but leaves its tasks, which
 * fall back to unassigned — a week's history should not lose rows because a client left.
 */
export async function deleteClient(formData: FormData) {
  await requireEditor();

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await prisma.client.delete({ where: { id } });

  revalidatePath("/clients");
  revalidatePath("/");
  redirect("/clients");
}
