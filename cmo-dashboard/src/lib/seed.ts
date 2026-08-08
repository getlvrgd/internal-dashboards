import "server-only";

import { prisma } from "./db";
import { DASHBOARD_STATUS, slugify, uniqueSlug } from "./options";
import { parseSopContent, starterSopContent, type SopContent } from "./sops";

/**
 * What a new dashboard is created with.
 *
 * Note what is deliberately NOT here: no passwords, no email addresses, no account
 * values of any kind. Logins now live under a client, and a brand-new dashboard has no
 * clients — so there is nothing to seed and nothing that could put a credential into
 * source control, where it would sit forever and defeat the encryption entirely.
 */

const STARTER_KPIS = [
  { label: "Booked calls", color: "blue" },
  { label: "Ad spend", color: "orange" },
  { label: "New subscribers", color: "aqua" },
  { label: "Cost per lead", color: "violet" },
];

/** The dashboard first-run setup creates, so the owner lands somewhere real. */
export const FIRST_DASHBOARD = {
  name: "CMO Dashboard",
  slug: "cmo",
  description: "Weekly board, client roster and SOP library for marketing.",
  color: "blue",
};

export async function takenDashboardSlugs() {
  const rows = await prisma.dashboard.findMany({ select: { slug: true } });
  return rows.map((r) => r.slug);
}

/**
 * Creates a dashboard and everything it starts life with.
 *
 * `copyFromId` clones an existing dashboard's SOP library and KPI row — the shape of
 * something that already works, without any of its clients or its week. When it is
 * absent the starter library is used instead.
 *
 * Clients, tasks and logins are never copied. They are the specific work of the
 * dashboard they belong to, and a new one arriving pre-populated with another team's
 * clients would be worse than empty.
 */
export async function createDashboardWithContent(input: {
  name: string;
  description?: string | null;
  color?: string;
  copyFromId?: string | null;
}) {
  const base = slugify(input.name, "dashboard");
  const slug = uniqueSlug(base, await takenDashboardSlugs());

  let sopContent: SopContent = starterSopContent();
  let kpis = STARTER_KPIS;

  if (input.copyFromId) {
    const source = await prisma.dashboard.findUnique({
      where: { id: input.copyFromId },
      select: {
        sopContent: true,
        kpis: {
          orderBy: { position: "asc" },
          select: { label: true, color: true, sublabel: true },
        },
      },
    });
    if (source) {
      const parsed = parseSopContent(source.sopContent);
      // An empty library is not worth copying — fall back to the starter, or the new
      // dashboard begins with no SOP structure at all.
      if (parsed.sections.length > 0) sopContent = parsed;
      if (source.kpis.length > 0) {
        kpis = source.kpis.map((k) => ({
          label: k.label,
          color: k.color,
        }));
      }
    }
  }

  const last = await prisma.dashboard.findFirst({
    orderBy: { position: "desc" },
    select: { position: true },
  });

  return prisma.dashboard.create({
    data: {
      name: input.name,
      slug,
      description: input.description?.trim() || null,
      color: input.color ?? "blue",
      status: DASHBOARD_STATUS.DRAFT,
      position: (last?.position ?? -1) + 1,
      sopContent: sopContent as unknown as object,
      kpis: {
        create: kpis.map((kpi, index) => ({ ...kpi, position: index })),
      },
    },
  });
}

/**
 * The first dashboard, created alongside the owner account by /setup.
 *
 * A no-op if any dashboard already exists, so re-running setup cannot produce a second
 * empty CMO board.
 */
export async function seedFirstDashboard() {
  if ((await prisma.dashboard.count()) > 0) return;

  const last = await prisma.dashboard.findFirst({
    orderBy: { position: "desc" },
    select: { position: true },
  });

  await prisma.dashboard.create({
    data: {
      name: FIRST_DASHBOARD.name,
      slug: FIRST_DASHBOARD.slug,
      description: FIRST_DASHBOARD.description,
      color: FIRST_DASHBOARD.color,
      status: DASHBOARD_STATUS.LIVE,
      // The one new dashboards are cloned from until the owner says otherwise.
      isTemplate: true,
      position: (last?.position ?? -1) + 1,
      sopContent: starterSopContent() as unknown as object,
      kpis: {
        create: STARTER_KPIS.map((kpi, index) => ({ ...kpi, position: index })),
      },
    },
  });
}
