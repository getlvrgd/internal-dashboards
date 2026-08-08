"use client";

import { useActionState } from "react";

import { addTeamMember, type TeamState } from "@/app/actions/team";
import { Field, inputClass, primaryButtonClass } from "@/components/ui";
import { ASSIGNABLE_ROLES } from "@/lib/options";

export function AddMemberForm() {
  const [state, formAction, pending] = useActionState<TeamState, FormData>(
    addTeamMember,
    {},
  );

  return (
    <form
      action={formAction}
      className="space-y-3 rounded-xl border border-subtle bg-surface p-4"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name">
          <input name="name" required maxLength={80} className={inputClass} />
        </Field>

        <Field label="Email">
          <input
            name="email"
            type="email"
            required
            autoComplete="off"
            className={inputClass}
          />
        </Field>

        <Field
          label="Password"
          hint="You set it and pass it on — nothing is emailed."
        >
          <input
            name="password"
            type="password"
            minLength={8}
            required
            autoComplete="new-password"
            className={inputClass}
          />
        </Field>

        <Field label="Role">
          <select name="role" defaultValue="CMO" className={inputClass}>
            {ASSIGNABLE_ROLES.map((role) => (
              <option key={role.value} value={role.value}>
                {role.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {state.error && (
        <p role="alert" className="text-[13px] text-critical">
          {state.error}
        </p>
      )}
      {state.ok && (
        <p role="status" className="text-[13px]" style={{ color: "var(--status-good)" }}>
          {state.ok}
        </p>
      )}

      <button type="submit" disabled={pending} className={primaryButtonClass}>
        {pending ? "Adding…" : "Add person"}
      </button>
    </form>
  );
}
