"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireVaultAccess, requireVaultWrite } from "@/lib/access";
import { prisma } from "@/lib/db";
import { open, seal, vaultConfigured } from "@/lib/secrets";

/**
 * A client's logins.
 *
 * There is no company-wide vault any more. A login belongs to the client whose account
 * it is, which means every action here needs two things to be true, not one:
 *
 *   1. The caller may open logins on this dashboard — requireVaultAccess().
 *   2. The row they named actually lives in it — ownedCredential().
 *
 * The second is the one that is easy to leave out and expensive to get wrong. The id in
 * the form is user input; without re-reading it against the resolved dashboard, a
 * manager of one dashboard could reveal a password belonging to another just by posting
 * its id. Nothing here trusts the form beyond using it as a lookup key.
 */

const credentialSchema = z.object({
  service: z.string().trim().min(1, "Which service is this for?").max(80),
  url: z.string().trim().max(500),
  identity: z.string().trim().max(320),
  notes: z.string().trim().max(2000),
});

function readCredential(formData: FormData) {
  return credentialSchema.safeParse({
    service: formData.get("service") ?? "",
    url: formData.get("url") ?? "",
    identity: formData.get("identity") ?? "",
    notes: formData.get("notes") ?? "",
  });
}

/**
 * The credential named by `id`, but only if it belongs to a client of `dashboardId`.
 * Returns null otherwise, and every caller treats null as "do nothing".
 */
async function ownedCredential(id: string, dashboardId: string) {
  if (!id) return null;
  return prisma.credential.findFirst({
    where: { id, client: { dashboardId } },
    select: { id: true, secretCipher: true, client: { select: { slug: true } } },
  });
}

/** The client named by `clientId`, but only if it belongs to `dashboardId`. */
async function ownedClient(clientId: string, dashboardId: string) {
  if (!clientId) return null;
  return prisma.client.findFirst({
    where: { id: clientId, dashboardId },
    select: { id: true, slug: true },
  });
}

const revalidateClient = (dashboardSlug: string, clientSlug: string) => {
  revalidatePath(`/d/${dashboardSlug}/clients/${clientSlug}`);
  // The board carries the same directory, so it has to be refreshed too.
  revalidatePath(`/d/${dashboardSlug}`);
};

/**
 * Remembers a tool so it can be offered next time.
 *
 * Learned rather than curated: the preset list fills itself from what people actually
 * save, which is the only version of this that stays current. Only the service and its
 * URL are kept — never the account, never the password.
 */
async function rememberPreset(service: string, url: string | null) {
  const name = service.trim();
  if (!name) return;

  const existing = await prisma.loginPreset.findFirst({
    where: { service: { equals: name, mode: "insensitive" } },
    select: { id: true, url: true },
  });

  if (existing) {
    // Only fills a blank URL; it never overwrites one someone has corrected.
    if (!existing.url && url) {
      await prisma.loginPreset.update({
        where: { id: existing.id },
        data: { url },
      });
    }
    return;
  }

  await prisma.loginPreset.create({ data: { service: name, url } });
}

export async function createCredential(
  dashboardSlug: string,
  formData: FormData,
) {
  const { dashboard } = await requireVaultWrite(dashboardSlug);

  const parsed = readCredential(formData);
  if (!parsed.success) return;

  const client = await ownedClient(
    String(formData.get("clientId") ?? ""),
    dashboard.id,
  );
  if (!client) return;

  const secret = String(formData.get("secret") ?? "");

  const last = await prisma.credential.findFirst({
    where: { clientId: client.id },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  await prisma.credential.create({
    data: {
      service: parsed.data.service,
      url: parsed.data.url || null,
      identity: parsed.data.identity || null,
      notes: parsed.data.notes || null,
      clientId: client.id,
      secretCipher: secret ? seal(secret) : null,
      position: (last?.position ?? -1) + 1,
    },
  });

  await rememberPreset(parsed.data.service, parsed.data.url || null);
  revalidateClient(dashboardSlug, client.slug);
}

export async function updateCredential(
  dashboardSlug: string,
  formData: FormData,
) {
  const { dashboard } = await requireVaultWrite(dashboardSlug);

  const existing = await ownedCredential(
    String(formData.get("id") ?? ""),
    dashboard.id,
  );
  if (!existing) return;

  const parsed = readCredential(formData);
  if (!parsed.success) return;

  const secret = String(formData.get("secret") ?? "");

  await prisma.credential.update({
    where: { id: existing.id },
    data: {
      service: parsed.data.service,
      url: parsed.data.url || null,
      identity: parsed.data.identity || null,
      notes: parsed.data.notes || null,
      // A blank password field means "leave it alone", not "clear it". The form never
      // pre-fills the current value — it is not decrypted to render the page — so
      // treating blank as a deletion would wipe the password on every unrelated edit.
      ...(secret ? { secretCipher: seal(secret) } : {}),
    },
  });

  await rememberPreset(parsed.data.service, parsed.data.url || null);
  revalidateClient(dashboardSlug, existing.client.slug);
}

/** Explicitly empties the password while keeping the row. */
export async function clearSecret(dashboardSlug: string, formData: FormData) {
  const { dashboard } = await requireVaultWrite(dashboardSlug);

  const existing = await ownedCredential(
    String(formData.get("id") ?? ""),
    dashboard.id,
  );
  if (!existing) return;

  await prisma.credential.update({
    where: { id: existing.id },
    data: { secretCipher: null },
  });

  revalidateClient(dashboardSlug, existing.client.slug);
}

export async function deleteCredential(
  dashboardSlug: string,
  formData: FormData,
) {
  const { dashboard } = await requireVaultWrite(dashboardSlug);

  const existing = await ownedCredential(
    String(formData.get("id") ?? ""),
    dashboard.id,
  );
  if (!existing) return;

  await prisma.credential.delete({ where: { id: existing.id } });
  revalidateClient(dashboardSlug, existing.client.slug);
}

export type RevealResult = { value?: string; error?: string };

/**
 * Decrypts one password, for one click.
 *
 * Returned to the caller rather than rendered into the page so a password is never in
 * the HTML of a page nobody asked to reveal it on — including any copy of that HTML a
 * proxy or a screenshot might keep.
 */
export async function revealSecret(
  dashboardSlug: string,
  id: string,
): Promise<RevealResult> {
  const { dashboard } = await requireVaultAccess(dashboardSlug);

  if (!vaultConfigured()) {
    return { error: "CREDENTIAL_KEY is not set on the server." };
  }

  const row = await ownedCredential(id, dashboard.id);
  if (!row?.secretCipher) return { error: "No password saved." };

  const value = open(row.secretCipher);
  if (value === null) {
    // Almost always a changed CREDENTIAL_KEY rather than corruption.
    return { error: "Could not decrypt — was CREDENTIAL_KEY changed?" };
  }
  return { value };
}
