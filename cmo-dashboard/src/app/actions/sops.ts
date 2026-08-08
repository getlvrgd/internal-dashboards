"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireEditor } from "@/lib/access";
import { prisma } from "@/lib/db";

const categorySchema = z.string().trim().min(1).max(60);

export async function createCategory(formData: FormData) {
  await requireEditor();

  const parsed = categorySchema.safeParse(formData.get("name"));
  if (!parsed.success) return;

  // `name` is unique, so a repeat submit should be a no-op rather than a crash.
  const existing = await prisma.sopCategory.findUnique({
    where: { name: parsed.data },
    select: { id: true },
  });
  if (existing) return;

  const last = await prisma.sopCategory.findFirst({
    orderBy: { position: "desc" },
    select: { position: true },
  });

  await prisma.sopCategory.create({
    data: { name: parsed.data, position: (last?.position ?? -1) + 1 },
  });

  revalidatePath("/sops");
}

export async function deleteCategory(formData: FormData) {
  await requireEditor();

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  // Cascades to the SOPs inside it — the confirmation for that lives in the UI.
  await prisma.sopCategory.delete({ where: { id } });
  revalidatePath("/sops");
}

const sopSchema = z.object({
  categoryId: z.string().min(1),
  title: z.string().trim().min(1, "A SOP needs a title.").max(160),
  objective: z.string().trim().max(160),
  url: z.string().trim().max(500),
  summary: z.string().trim().max(2000),
});

export async function createSop(formData: FormData) {
  await requireEditor();

  const parsed = sopSchema.safeParse({
    categoryId: formData.get("categoryId") ?? "",
    title: formData.get("title") ?? "",
    objective: formData.get("objective") ?? "",
    url: formData.get("url") ?? "",
    summary: formData.get("summary") ?? "",
  });
  if (!parsed.success) return;

  const last = await prisma.sop.findFirst({
    where: { categoryId: parsed.data.categoryId },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  await prisma.sop.create({
    data: {
      categoryId: parsed.data.categoryId,
      title: parsed.data.title,
      objective: parsed.data.objective || null,
      url: parsed.data.url || null,
      summary: parsed.data.summary || null,
      position: (last?.position ?? -1) + 1,
    },
  });

  revalidatePath("/sops");
}

export async function updateSop(formData: FormData) {
  await requireEditor();

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const parsed = sopSchema.safeParse({
    categoryId: formData.get("categoryId") ?? "",
    title: formData.get("title") ?? "",
    objective: formData.get("objective") ?? "",
    url: formData.get("url") ?? "",
    summary: formData.get("summary") ?? "",
  });
  if (!parsed.success) return;

  await prisma.sop.update({
    where: { id },
    data: {
      categoryId: parsed.data.categoryId,
      title: parsed.data.title,
      objective: parsed.data.objective || null,
      url: parsed.data.url || null,
      summary: parsed.data.summary || null,
    },
  });

  revalidatePath("/sops");
}

export async function deleteSop(formData: FormData) {
  await requireEditor();

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await prisma.sop.delete({ where: { id } });
  revalidatePath("/sops");
}
