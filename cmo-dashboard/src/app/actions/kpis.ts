"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireEditor } from "@/lib/access";
import { prisma } from "@/lib/db";
import { isTileColor, TILE_COLORS } from "@/lib/options";

const kpiSchema = z.object({
  label: z.string().trim().min(1, "A tile needs a label.").max(60),
  // Free text on purpose: "12.4k", "3.2%" and "£8,400" all belong in the same row, and
  // forcing them into a number would mean a unit column and a formatter for each.
  value: z.string().trim().max(24),
  sublabel: z.string().trim().max(60),
  color: z
    .string()
    .trim()
    .refine(isTileColor)
    .catch(TILE_COLORS[0].value),
});

export async function createKpi(formData: FormData) {
  await requireEditor();

  const parsed = kpiSchema.safeParse({
    label: formData.get("label") ?? "",
    value: formData.get("value") ?? "",
    sublabel: formData.get("sublabel") ?? "",
    color: formData.get("color") ?? "",
  });
  if (!parsed.success) return;

  const last = await prisma.kpi.findFirst({
    orderBy: { position: "desc" },
    select: { position: true },
  });

  await prisma.kpi.create({
    data: {
      label: parsed.data.label,
      value: parsed.data.value || "—",
      sublabel: parsed.data.sublabel || null,
      color: parsed.data.color,
      position: (last?.position ?? -1) + 1,
    },
  });

  revalidatePath("/");
}

export async function updateKpi(formData: FormData) {
  await requireEditor();

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const parsed = kpiSchema.safeParse({
    label: formData.get("label") ?? "",
    value: formData.get("value") ?? "",
    sublabel: formData.get("sublabel") ?? "",
    color: formData.get("color") ?? "",
  });
  if (!parsed.success) return;

  await prisma.kpi.update({
    where: { id },
    data: {
      label: parsed.data.label,
      value: parsed.data.value || "—",
      sublabel: parsed.data.sublabel || null,
      color: parsed.data.color,
    },
  });

  revalidatePath("/");
}

export async function deleteKpi(formData: FormData) {
  await requireEditor();

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await prisma.kpi.delete({ where: { id } });
  revalidatePath("/");
}
