import "server-only";

import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

import { prisma } from "./db";
import { canEdit, hasAdminAccess, ROLES, type Role } from "./options";

const COOKIE = "dashboards_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

/**
 * What the cookie carries.
 *
 * Deliberately only the platform role. Which dashboards this person may open is NOT in
 * the token: it is read from Membership on every request. A token lives thirty days, so
 * baking access into it would mean revoking a grant did nothing until the session
 * expired — see resolveDashboard() in src/lib/access.ts.
 */
export type Session = {
  userId: string;
  name: string;
  role: Role;
};

export const isAdmin = (session: Session) => hasAdminAccess(session.role);
export const isOwner = (session: Session) => session.role === ROLES.OWNER;
export const sessionCanEdit = (session: Session) => canEdit(session.role);

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 32) {
    // Failing loudly beats silently signing sessions with a guessable key.
    throw new Error(
      "AUTH_SECRET is missing or shorter than 32 characters. Set it in .env.",
    );
  }
  return new TextEncoder().encode(value);
}

export async function hashPassword(plain: string) {
  return bcrypt.hash(plain, 12);
}

/**
 * Verifies a login. Returns null for both "no such user" and "wrong password" so the
 * response cannot be used to discover which email addresses exist.
 */
export async function verifyCredentials(email: string, password: string) {
  const user = await prisma.user.findFirst({
    where: { email: email.toLowerCase().trim(), isActive: true },
  });
  if (!user) {
    // Spend the same time hashing as a real check would, so timing does not leak
    // whether the account exists.
    await bcrypt.compare(
      password,
      "$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv",
    );
    return null;
  }
  const ok = await bcrypt.compare(password, user.passwordHash);
  return ok ? user : null;
}

export async function createSession(user: {
  id: string;
  name: string;
  role: string;
}) {
  const token = await new SignJWT({ name: user.name, role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secret());

  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function destroySession() {
  const store = await cookies();
  store.delete(COOKIE);
}

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secret());
    if (!payload.sub) return null;
    return {
      userId: payload.sub,
      name: String(payload.name),
      role: payload.role as Role,
    };
  } catch {
    // Expired or tampered token — treat as signed out.
    return null;
  }
}
