"use server";

import { revalidatePath } from "next/cache";

import { requireDashboardWrite } from "@/lib/access";
import { prisma } from "@/lib/db";
import { parseAmountToCents } from "@/lib/money";

/**
 * Revenue, logged by hand.
 *
 * Deliberately manual for now. The intention is that payments arrive attributed to a
 * client automatically, which is why Payment already carries an optional clientId — the
 * rows written today will still be usable when that lands, instead of needing a backfill
 * nobody can do accurately months later.
 */

export type RevenueState = { error?: string };

export async function addPayment(
  dashboardSlug: string,
  _previous: RevenueState,
  formData: FormData,
): Promise<RevenueState> {
  const { dashboard } = await requireDashboardWrite(dashboardSlug);

  const cents = parseAmountToCents(String(formData.get("amount") ?? ""));
  if (cents === null) return { error: "Enter an amount." };

  // A client may be named; it is verified against this dashboard rather than trusted,
  // so a crafted form cannot attribute revenue to someone else's client.
  const clientId = String(formData.get("clientId") ?? "");
  const client = clientId
    ? await prisma.client.findFirst({
        where: { id: clientId, dashboardId: dashboard.id },
        select: { id: true },
      })
    : null;

  // An explicit date is accepted because money is often logged the morning after it
  // landed, and filing it under today would misreport both days.
  const dateInput = String(formData.get("receivedAt") ?? "").trim();
  const receivedAt = dateInput
    ? new Date(`${dateInput}T12:00:00.000Z`)
    : new Date();

  await prisma.payment.create({
    data: {
      dashboardId: dashboard.id,
      amountCents: cents,
      note: String(formData.get("note") ?? "").trim() || null,
      clientId: client?.id ?? null,
      receivedAt: Number.isNaN(receivedAt.getTime()) ? new Date() : receivedAt,
    },
  });

  revalidatePath(`/d/${dashboardSlug}`);
  return {};
}

export async function deletePayment(
  dashboardSlug: string,
  formData: FormData,
) {
  const { dashboard } = await requireDashboardWrite(dashboardSlug);

  const payment = await prisma.payment.findFirst({
    where: { id: String(formData.get("id") ?? ""), dashboardId: dashboard.id },
    select: { id: true },
  });
  if (!payment) return;

  await prisma.payment.delete({ where: { id: payment.id } });
  revalidatePath(`/d/${dashboardSlug}`);
}

/** The daily target the ring is a percentage of. Zero clears it. */
export async function setRevenueGoal(
  dashboardSlug: string,
  formData: FormData,
) {
  const { dashboard } = await requireDashboardWrite(dashboardSlug);

  const raw = String(formData.get("goal") ?? "").trim();
  // Blank or zero is "no goal", which the panel renders as a plain total rather than a
  // percentage of nothing.
  const cents = raw === "" ? 0 : (parseAmountToCents(raw) ?? 0);

  await prisma.dashboard.update({
    where: { id: dashboard.id },
    data: { revenueGoalCents: cents },
  });

  revalidatePath(`/d/${dashboardSlug}`);
}
