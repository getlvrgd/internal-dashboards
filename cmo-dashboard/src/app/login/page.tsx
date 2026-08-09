"use client";

import { useActionState } from "react";

import { login, type LoginState } from "@/app/actions/auth";
import { Logo } from "@/components/Logo";
import { Field, inputClass, primaryButtonClass } from "@/components/ui";

/**
 * One sign-in for everyone. There is no separate admin URL: the role on the account
 * decides what you can reach, so a CMO cannot find the vault by guessing a login page.
 */
export default function LoginPage() {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    login,
    {},
  );

  return (
    <div className="flex min-h-full flex-1 items-center justify-center px-5 py-12">
      <div className="w-full max-w-sm">
        <Logo height={26} />

        <h1 className="mt-4 text-[22px] font-extrabold tracking-[-0.08em]">
          CMO Dashboard
        </h1>
        <p className="mt-1 text-[13px] text-ink-secondary">
          Sign in to reach the board.
        </p>

        <form action={formAction} className="mt-6 space-y-4">
          <Field label="Email">
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              className={inputClass}
            />
          </Field>

          <Field label="Password">
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className={inputClass}
            />
          </Field>

          {state.error && (
            <p role="alert" className="text-[13px] text-critical">
              {state.error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className={`w-full ${primaryButtonClass}`}
          >
            {pending ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
