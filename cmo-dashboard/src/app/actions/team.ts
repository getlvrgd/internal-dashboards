"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/lib/access";
import { hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ASSIGNABLE_ROLES, ROLES } from "@/lib/options";

const ASSIGNABLE = ASSIGNABLE_ROLES.map((r) => r.value) as [string, ...string[]];

export type TeamState = { error?: string; ok?: string };

const inviteSchema = z.object({
  name: z.string().trim().min(1, "Enter a name.").max(80),
  email: z.email("Enter a valid email.").max(320),
  password: z.string().min(8, "Use at least 8 characters."),
  // OWNER is absent from ASSIGNABLE_ROLES on purpose, so this cannot mint a second one.
  role: z.enum(ASSIGNABLE),
});

/**
 * Adds an account with a password you set and hand over.
 *
 * No email is sent — there is no mail transport in this app, and a dashboard used by a
 * handful of people does not need an invite flow to become a thing that can break.
 */
export async function addTeamMember(
  _previous: TeamState,
  formData: FormData,
): Promise<TeamState> {
  await requireAdmin();

  const parsed = inviteSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the details." };
  }

  const email = parsed.data.email.toLowerCase().trim();
  if (await prisma.user.findUnique({ where: { email } })) {
    return { error: "That email already has an account." };
  }

  await prisma.user.create({
    data: {
      name: parsed.data.name,
      email,
      role: parsed.data.role,
      passwordHash: await hashPassword(parsed.data.password),
    },
  });

  revalidatePath("/team");
  return { ok: `${parsed.data.name} can sign in now.` };
}

export async function setRole(formData: FormData) {
  const session = await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const role = String(formData.get("role") ?? "");
  if (!id || !ASSIGNABLE.includes(role)) return;

  const target = await prisma.user.findUnique({
    where: { id },
    select: { role: true },
  });
  // The owner's role is not editable, by anyone including themselves — there must always
  // be exactly one account that can never be locked out of the vault.
  if (!target || target.role === ROLES.OWNER) return;
  if (id === session.userId) return;

  await prisma.user.update({ where: { id }, data: { role } });
  revalidatePath("/team");
}

/** Access is revoked by deactivating, so past tasks keep the person who owned them. */
export async function setActive(formData: FormData) {
  const session = await requireAdmin();

  const id = String(formData.get("id") ?? "");
  if (!id || id === session.userId) return;

  const target = await prisma.user.findUnique({
    where: { id },
    select: { role: true, isActive: true },
  });
  if (!target || target.role === ROLES.OWNER) return;

  await prisma.user.update({
    where: { id },
    data: { isActive: !target.isActive },
  });
  revalidatePath("/team");
}

const passwordSchema = z.string().min(8);

export async function resetPassword(formData: FormData) {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const parsed = passwordSchema.safeParse(formData.get("password"));
  if (!id || !parsed.success) return;

  await prisma.user.update({
    where: { id },
    data: { passwordHash: await hashPassword(parsed.data) },
  });
  revalidatePath("/team");
}
