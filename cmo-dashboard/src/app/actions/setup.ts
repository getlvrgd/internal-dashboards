"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { needsSetup } from "@/lib/access";
import { createSession, hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ROLES } from "@/lib/options";
import { seedStarterContent } from "@/lib/seed";

export type SetupState = { error?: string };

const setupSchema = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(80),
  email: z.email("Enter a valid email.").max(320),
  password: z.string().min(8, "Use at least 8 characters."),
});

/**
 * First run only. Creates the one owner account and the starter scaffolding — the SOP
 * categories and the KPI row — so the board is not a blank page on day one.
 *
 * `needsSetup` is re-checked here rather than trusted from the page: the page guard runs
 * on render, and without this a stale open tab could post a second owner months later.
 */
export async function completeSetup(
  _previous: SetupState,
  formData: FormData,
): Promise<SetupState> {
  if (!(await needsSetup())) {
    return { error: "This dashboard has already been set up." };
  }

  const parsed = setupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check your details." };
  }

  const email = parsed.data.email.toLowerCase().trim();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { error: "That email is already in use." };

  const user = await prisma.user.create({
    data: {
      name: parsed.data.name,
      email,
      passwordHash: await hashPassword(parsed.data.password),
      role: ROLES.OWNER,
    },
  });

  await seedStarterContent();
  await createSession(user);
  redirect("/");
}
