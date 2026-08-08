"use server";

import { revalidatePath } from "next/cache";

import { requireDashboardManager } from "@/lib/access";
import { prisma } from "@/lib/db";
import { parseSopContent } from "@/lib/sops";

/**
 * Saving the SOP library.
 *
 * The library is one document, so it is written whole rather than field by field. The
 * editor holds the working copy in the browser and posts it here on Save — which is why
 * there is one action rather than the twenty a table-per-block model would have needed.
 *
 * What arrives is JSON from a client component, so it is re-parsed through
 * parseSopContent() before it is stored. That drops anything unrecognised and fills in
 * anything missing: the column must never hold a shape the reader cannot render, or one
 * bad save takes the page down for everyone.
 */
export async function saveSopContent(dashboardSlug: string, raw: string) {
  const { dashboard } = await requireDashboardManager(dashboardSlug);

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    return { error: "Could not read that." };
  }

  const content = parseSopContent(parsedJson);

  await prisma.dashboard.update({
    where: { id: dashboard.id },
    data: { sopContent: content as unknown as object },
  });

  revalidatePath(`/d/${dashboardSlug}/sops`);
  revalidatePath("/hub");
  return { ok: true as const };
}
