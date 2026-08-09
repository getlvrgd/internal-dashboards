"use client";

import { useActionState } from "react";

import { completeSetup, type SetupState } from "@/app/actions/setup";
import { Logo } from "@/components/Logo";
import { Field, inputClass, primaryButtonClass } from "@/components/ui";

export function SetupForm() {
  const [state, formAction, pending] = useActionState<SetupState, FormData>(
    completeSetup,
    {},
  );

  return (
    <div className="flex min-h-full flex-1 items-center justify-center px-5 py-12">
      <div className="w-full max-w-sm">
        <Logo height={26} />

        <h1 className="mt-4 text-[22px] font-extrabold tracking-[-0.08em]">
          Create the owner account
        </h1>
        <p className="mt-1 text-[13px] text-ink-secondary">
          This is the only account that can be created from a public page. Everyone
          else is added by you, from the Team tab.
        </p>

        <form action={formAction} className="mt-6 space-y-4">
          <Field label="Your name">
            <input name="name" required className={inputClass} />
          </Field>

          <Field label="Email">
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              className={inputClass}
            />
          </Field>

          <Field label="Password" hint="At least 8 characters.">
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
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
            {pending ? "Creating…" : "Create account"}
          </button>
        </form>
      </div>
    </div>
  );
}
