"use server";

import { revalidatePath } from "next/cache";

import {
  requireDashboardEditor,
  requireDashboardManager,
  resolveClient,
} from "@/lib/access";
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

/**
 * Saving one client's asset directory.
 *
 * Same document shape as the SOP library, saved somewhere else: SOPs are how the team
 * works and belong to the dashboard, while assets — the deck, the VSL, the ad account —
 * belong to the offer they were made for.
 */
export async function saveClientAssets(
  dashboardSlug: string,
  clientSlug: string,
  raw: string,
) {
  const { client } = await resolveClient(dashboardSlug, clientSlug);
  const context = await requireDashboardEditor(dashboardSlug);
  void context;

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    return { error: "Could not read that." };
  }

  await prisma.client.update({
    where: { id: client.id },
    data: { assetsContent: parseSopContent(parsedJson) as unknown as object },
  });

  revalidatePath(`/d/${dashboardSlug}/clients/${clientSlug}`);
  return { ok: true as const };
}
