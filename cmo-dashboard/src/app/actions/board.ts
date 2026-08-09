"use server";

import { revalidatePath } from "next/cache";

import { requireDashboardWrite, resolveClient } from "@/lib/access";
import {
  DEFAULT_CLIENT_PANELS,
  DEFAULT_PANELS,
  parseBoardLayout,
} from "@/lib/board";
import { prisma } from "@/lib/db";

/**
 * Saving a board's layout — panel order, headings, what is hidden.
 *
 * One action taking the whole layout, for the same reason the block library has one: it
 * is edited in bursts (drag two panels, retitle one, hide another) and a write per
 * change would be a lot of round trips for something one person adjusts occasionally.
 *
 * What arrives is JSON from a client component, so it goes back through
 * parseBoardLayout() before it is stored. That drops anything the surface does not
 * offer and appends any panel the layout is missing, so the column can never hold a
 * shape the board cannot render.
 */
export async function saveBoardLayout(dashboardSlug: string, raw: string) {
  const { dashboard } = await requireDashboardWrite(dashboardSlug);

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    return { error: "Could not read that layout." };
  }

  await prisma.dashboard.update({
    where: { id: dashboard.id },
    data: {
      boardLayout: parseBoardLayout(
        parsedJson,
        DEFAULT_PANELS,
      ) as unknown as object,
    },
  });

  revalidatePath(`/d/${dashboardSlug}`);
  return { ok: true as const };
}

/** The same, for one client's board. */
export async function saveClientBoardLayout(
  dashboardSlug: string,
  clientSlug: string,
  raw: string,
) {
  await requireDashboardWrite(dashboardSlug);
  const { client } = await resolveClient(dashboardSlug, clientSlug);

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    return { error: "Could not read that layout." };
  }

  await prisma.client.update({
    where: { id: client.id },
    data: {
      boardLayout: parseBoardLayout(
        parsedJson,
        DEFAULT_CLIENT_PANELS,
      ) as unknown as object,
    },
  });

  revalidatePath(`/d/${dashboardSlug}/clients/${clientSlug}`);
  return { ok: true as const };
}
