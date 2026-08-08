"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireVaultAccess } from "@/lib/access";
import { prisma } from "@/lib/db";
import { open, seal, vaultConfigured } from "@/lib/secrets";

/**
 * The login vault.
 *
 * Every action here — including the read — goes through requireVaultAccess() rather
 * than the ordinary editor check. A CMO or viewer session that posts straight to these
 * gets an error, not a credential.
 *
 * Nothing in this file returns a decrypted password except revealSecret(), which is
 * called one row at a time by a deliberate click. The list page never decrypts.
 */

const credentialSchema = z.object({
  service: z.string().trim().min(1, "Which service is this for?").max(80),
  url: z.string().trim().max(500),
  identity: z.string().trim().max(320),
  notes: z.string().trim().max(2000),
  clientId: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .nullable(),
});

function readCredential(formData: FormData) {
  return credentialSchema.safeParse({
    service: formData.get("service") ?? "",
    url: formData.get("url") ?? "",
    identity: formData.get("identity") ?? "",
    notes: formData.get("notes") ?? "",
    clientId: formData.get("clientId") ?? "",
  });
}

export async function createCredential(formData: FormData) {
  await requireVaultAccess();

  const parsed = readCredential(formData);
  if (!parsed.success) return;

  const secret = String(formData.get("secret") ?? "");

  const last = await prisma.credential.findFirst({
    orderBy: { position: "desc" },
    select: { position: true },
  });

  await prisma.credential.create({
    data: {
      service: parsed.data.service,
      url: parsed.data.url || null,
      identity: parsed.data.identity || null,
      notes: parsed.data.notes || null,
      clientId: parsed.data.clientId,
      secretCipher: secret ? seal(secret) : null,
      position: (last?.position ?? -1) + 1,
    },
  });

  revalidatePath("/logins");
}

export async function updateCredential(formData: FormData) {
  await requireVaultAccess();

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const parsed = readCredential(formData);
  if (!parsed.success) return;

  const secret = String(formData.get("secret") ?? "");

  await prisma.credential.update({
    where: { id },
    data: {
      service: parsed.data.service,
      url: parsed.data.url || null,
      identity: parsed.data.identity || null,
      notes: parsed.data.notes || null,
      clientId: parsed.data.clientId,
      // A blank password field means "leave it alone", not "clear it". The form never
      // pre-fills the current value — it is not decrypted to render the page — so
      // treating blank as a deletion would wipe the password on every unrelated edit.
      ...(secret ? { secretCipher: seal(secret) } : {}),
    },
  });

  revalidatePath("/logins");
}

/** Explicitly empties the password while keeping the row. */
export async function clearSecret(formData: FormData) {
  await requireVaultAccess();

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await prisma.credential.update({
    where: { id },
    data: { secretCipher: null },
  });

  revalidatePath("/logins");
}

export async function deleteCredential(formData: FormData) {
  await requireVaultAccess();

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await prisma.credential.delete({ where: { id } });
  revalidatePath("/logins");
}

export type RevealResult = { value?: string; error?: string };

/**
 * Decrypts one password, for one click.
 *
 * Returned to the caller rather than rendered into the page so a password is never in
 * the HTML of a page nobody asked to reveal it on — including any copy of that HTML a
 * proxy or a screenshot might keep.
 */
export async function revealSecret(id: string): Promise<RevealResult> {
  await requireVaultAccess();

  if (!vaultConfigured()) {
    return { error: "CREDENTIAL_KEY is not set on the server." };
  }

  const row = await prisma.credential.findUnique({
    where: { id },
    select: { secretCipher: true },
  });
  if (!row?.secretCipher) return { error: "No password saved." };

  const value = open(row.secretCipher);
  if (value === null) {
    // Almost always a changed CREDENTIAL_KEY rather than corruption.
    return { error: "Could not decrypt — was CREDENTIAL_KEY changed?" };
  }
  return { value };
}
