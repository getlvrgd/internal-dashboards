import "server-only";

import { redirect } from "next/navigation";

import {
  getSession,
  isAdmin,
  sessionCanEdit,
  sessionCanSeeCredentials,
  type Session,
} from "./auth";
import { prisma } from "./db";
import { ROLES } from "./options";

/**
 * The guards every page and action goes through.
 *
 * Kept in one file so the question "who can do this?" is answered in one place rather
 * than re-derived at each call site — that is how a check gets forgotten on the one
 * route that mattered.
 */

/** True until an owner exists. Only /setup asks. */
export async function needsSetup() {
  const owner = await prisma.user.findFirst({
    where: { role: ROLES.OWNER },
    select: { id: true },
  });
  return owner === null;
}

/**
 * The session, or a redirect. Sends a first-run visitor to /setup rather than a login
 * form no account can yet pass.
 */
export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (session) return session;
  if (await needsSetup()) redirect("/setup");
  redirect("/login");
}

/** For actions that write. A viewer gets a thrown error, not a silent no-op. */
export async function requireEditor(): Promise<Session> {
  const session = await requireSession();
  if (!sessionCanEdit(session)) {
    throw new Error("Read-only account.");
  }
  return session;
}

export async function requireAdmin(): Promise<Session> {
  const session = await requireSession();
  if (!isAdmin(session)) {
    throw new Error("Not allowed.");
  }
  return session;
}

/**
 * The login vault. Separate from requireAdmin only so the intent reads clearly at the
 * call sites that matter most — today the two are the same rule.
 */
export async function requireVaultAccess(): Promise<Session> {
  const session = await requireSession();
  if (!sessionCanSeeCredentials(session)) {
    throw new Error("Credentials are limited to the owner and admins.");
  }
  return session;
}
