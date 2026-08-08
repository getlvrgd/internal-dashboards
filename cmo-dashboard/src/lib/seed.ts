import "server-only";

import { prisma } from "./db";

/**
 * The scaffolding a brand-new dashboard starts with.
 *
 * Run once, by first-run setup. Every step is a no-op if rows already exist, so calling
 * it twice cannot double anything up.
 *
 * Note what is deliberately NOT here: no passwords, no email addresses, no account
 * values of any kind. The vault is seeded with the *shape* of the old board — the
 * services that need a login, including the domain and hosting accounts — and each row
 * is left blank for someone to fill in through the UI, where it is encrypted on the way
 * to the database. Copying credentials in as source code would defeat the encryption
 * entirely, since they would then live in the repository forever.
 */

/** Mirrors the tabs on the board this replaces, in the same order. */
const SOP_CATEGORIES = [
  "Ads",
  "YouTube",
  "Instagram",
  "VSL Funnel",
  "Calls",
  "Claude",
  "Webinar",
  "Waitlist",
  "Messaging",
];

/** The funnels the Ads tab tracked. Titles only — the documents get linked later. */
const STARTER_ADS_SOPS = [
  "Cold > VSL",
  "Cold > Webinar",
  "Retargeting",
  "Webinar",
];

/**
 * The services that need an account, with no values attached. Ordered roughly by how
 * often they get opened.
 */
const CREDENTIAL_SLOTS = [
  { service: "Kit", url: "https://app.kit.com" },
  { service: "Gmail", url: "https://mail.google.com" },
  { service: "Calendly", url: "https://calendly.com" },
  { service: "Instagram", url: "https://instagram.com" },
  { service: "YouTube", url: "https://studio.youtube.com" },
  { service: "Trakyo", url: "" },
  { service: "GoDaddy", url: "https://godaddy.com", notes: "Domains / hosting" },
];

const STARTER_KPIS = [
  { label: "Booked calls", color: "blue" },
  { label: "Ad spend", color: "orange" },
  { label: "New subscribers", color: "aqua" },
  { label: "Cost per lead", color: "violet" },
];

export async function seedStarterContent() {
  if ((await prisma.sopCategory.count()) === 0) {
    for (const [index, name] of SOP_CATEGORIES.entries()) {
      const category = await prisma.sopCategory.create({
        data: { name, position: index },
      });
      if (name === "Ads") {
        await prisma.sop.createMany({
          data: STARTER_ADS_SOPS.map((objective, i) => ({
            categoryId: category.id,
            title: objective,
            objective,
            position: i,
          })),
        });
      }
    }
  }

  if ((await prisma.kpi.count()) === 0) {
    await prisma.kpi.createMany({
      data: STARTER_KPIS.map((kpi, index) => ({ ...kpi, position: index })),
    });
  }

  if ((await prisma.credential.count()) === 0) {
    await prisma.credential.createMany({
      data: CREDENTIAL_SLOTS.map((slot, index) => ({
        service: slot.service,
        url: slot.url || null,
        notes: slot.notes ?? null,
        position: index,
      })),
    });
  }
}
