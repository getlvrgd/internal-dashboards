"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireDashboardWrite } from "@/lib/access";
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

const readKpi = (formData: FormData) =>
  kpiSchema.safeParse({
    label: formData.get("label") ?? "",
    value: formData.get("value") ?? "",
    sublabel: formData.get("sublabel") ?? "",
    color: formData.get("color") ?? "",
  });

export async function createKpi(dashboardSlug: string, formData: FormData) {
  const { dashboard } = await requireDashboardWrite(dashboardSlug);

  const parsed = readKpi(formData);
  if (!parsed.success) return;

  const last = await prisma.kpi.findFirst({
    where: { dashboardId: dashboard.id },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  await prisma.kpi.create({
    data: {
      dashboardId: dashboard.id,
      label: parsed.data.label,
      value: parsed.data.value || "—",
      sublabel: parsed.data.sublabel || null,
      color: parsed.data.color,
      position: (last?.position ?? -1) + 1,
    },
  });

  revalidatePath(`/d/${dashboardSlug}`);
}

export async function updateKpi(dashboardSlug: string, formData: FormData) {
  const { dashboard } = await requireDashboardWrite(dashboardSlug);

  const existing = await prisma.kpi.findFirst({
    where: { id: String(formData.get("id") ?? ""), dashboardId: dashboard.id },
    select: { id: true },
  });
  if (!existing) return;

  const parsed = readKpi(formData);
  if (!parsed.success) return;

  await prisma.kpi.update({
    where: { id: existing.id },
    data: {
      label: parsed.data.label,
      value: parsed.data.value || "—",
      sublabel: parsed.data.sublabel || null,
      color: parsed.data.color,
    },
  });

  revalidatePath(`/d/${dashboardSlug}`);
}

export async function deleteKpi(dashboardSlug: string, formData: FormData) {
  const { dashboard } = await requireDashboardWrite(dashboardSlug);

  const existing = await prisma.kpi.findFirst({
    where: { id: String(formData.get("id") ?? ""), dashboardId: dashboard.id },
    select: { id: true },
  });
  if (!existing) return;

  await prisma.kpi.delete({ where: { id: existing.id } });
  revalidatePath(`/d/${dashboardSlug}`);
}
