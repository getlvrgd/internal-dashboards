"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin, requireDashboardManager } from "@/lib/access";
import { hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  ALL_MEMBERSHIP_ROLES,
  ASSIGNABLE_ROLES,
  MEMBERSHIP_ROLES,
  ROLES,
} from "@/lib/options";

/**
 * Accounts, and who can open which dashboard.
 *
 * There is one roster for the whole app rather than a Team page per dashboard, because
 * the same person turns up on several and keeping a separate list per board is how two
 * of them end up disagreeing about whether someone still works here.
 *
 * Creating and deactivating an account is admin-only. Granting one dashboard is open to
 * that dashboard's manager as well — they are the person who knows who should be on it,
 * and the grant cannot reach past its own edge.
 */

const ASSIGNABLE = ASSIGNABLE_ROLES.map((r) => r.value) as [string, ...string[]];

export type PeopleState = { error?: string; ok?: string };

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
 * No email is sent — there is no mail transport in this app, and something used by a
 * handful of people does not need an invite flow to become a thing that can break.
 */
export async function addPerson(
  _previous: PeopleState,
  formData: FormData,
): Promise<PeopleState> {
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

  const user = await prisma.user.create({
    data: {
      name: parsed.data.name,
      email,
      role: parsed.data.role,
      passwordHash: await hashPassword(parsed.data.password),
    },
  });

  // A dashboard may be named on the form, so "add someone to the CMO board" is one step
  // rather than create-then-grant.
  const dashboardId = String(formData.get("dashboardId") ?? "");
  if (dashboardId && parsed.data.role === ROLES.MEMBER) {
    const exists = await prisma.dashboard.findUnique({
      where: { id: dashboardId },
      select: { id: true },
    });
    if (exists) {
      await prisma.membership.create({
        data: {
          userId: user.id,
          dashboardId: exists.id,
          role: MEMBERSHIP_ROLES.MEMBER,
        },
      });
    }
  }

  revalidatePath("/hub/people");
  return { ok: `${parsed.data.name} can sign in now.` };
}

export async function setPlatformRole(formData: FormData) {
  const session = await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const role = String(formData.get("role") ?? "");
  if (!id || !ASSIGNABLE.includes(role)) return;

  const target = await prisma.user.findUnique({
    where: { id },
    select: { role: true },
  });
  // The owner's role is not editable, by anyone including themselves — there must
  // always be exactly one account that cannot be locked out.
  if (!target || target.role === ROLES.OWNER) return;
  if (id === session.userId) return;

  await prisma.user.update({ where: { id }, data: { role } });
  revalidatePath("/hub/people");
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
  revalidatePath("/hub/people");
}

export async function resetPassword(formData: FormData) {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const parsed = z.string().min(8).safeParse(formData.get("password"));
  if (!id || !parsed.success) return;

  await prisma.user.update({
    where: { id },
    data: { passwordHash: await hashPassword(parsed.data) },
  });
  revalidatePath("/hub/people");
}

/* ------------------------------------------------------------- memberships -- */

/**
 * Grants, changes or removes one person's access to one dashboard.
 *
 * `role` of "" removes the grant. Owners and admins are never given a row — they reach
 * everything by platform role, and a membership for them would be a second source of
 * truth that could disagree with the first.
 */
export async function setMembership(dashboardSlug: string, formData: FormData) {
  const { dashboard } = await requireDashboardManager(dashboardSlug);

  const userId = String(formData.get("userId") ?? "");
  const role = String(formData.get("role") ?? "");
  if (!userId) return;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (!user) return;
  if (user.role === ROLES.OWNER || user.role === ROLES.ADMIN) return;

  if (!role) {
    await prisma.membership.deleteMany({
      where: { userId, dashboardId: dashboard.id },
    });
  } else if (ALL_MEMBERSHIP_ROLES.includes(role)) {
    await prisma.membership.upsert({
      where: { userId_dashboardId: { userId, dashboardId: dashboard.id } },
      create: { userId, dashboardId: dashboard.id, role },
      update: { role },
    });
  }

  revalidatePath(`/d/${dashboardSlug}/team`);
  revalidatePath("/hub/people");
  revalidatePath("/hub");
}
