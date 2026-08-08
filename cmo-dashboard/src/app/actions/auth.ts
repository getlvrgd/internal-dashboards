"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import {
  createSession,
  destroySession,
  verifyCredentials,
} from "@/lib/auth";

export type LoginState = { error?: string };

const loginSchema = z.object({
  email: z.string().trim().min(1, "Enter your email.").max(320),
  password: z.string().min(1, "Enter your password."),
});

export async function login(
  _previous: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check your details." };
  }

  const user = await verifyCredentials(parsed.data.email, parsed.data.password);
  if (!user) {
    // One message for both causes, so this cannot be used to enumerate accounts.
    return { error: "That email and password do not match an account." };
  }

  await createSession(user);
  redirect("/");
}

export async function signOut() {
  await destroySession();
  redirect("/login");
}
