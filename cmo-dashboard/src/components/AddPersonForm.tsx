"use client";

import { useActionState, useRef } from "react";

import { addPerson, type PeopleState } from "@/app/actions/people";
import { ASSIGNABLE_ROLES } from "@/lib/options";

import { inputClass, primaryButtonClass } from "./ui";

/**
 * Adds an account with a password you set and hand over.
 *
 * The password is generated rather than typed, because the alternative is whoever is
 * adding people picking the same one every time. It is shown once, here — it is stored
 * hashed, so nothing can read it back afterwards.
 */
export function AddPersonForm({
  dashboards,
}: {
  dashboards: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState<PeopleState, FormData>(
    addPerson,
    {},
  );
  const passwordRef = useRef<HTMLInputElement>(null);

  const generate = () => {
    // Browser CSPRNG rather than Math.random: this is a real credential, even if it is
    // only in play until the person changes it.
    const bytes = new Uint8Array(12);
    crypto.getRandomValues(bytes);
    const value = Array.from(bytes, (b) => b.toString(36).padStart(2, "0"))
      .join("")
      .slice(0, 16);
    if (passwordRef.current) passwordRef.current.value = value;
  };

  return (
    <form
      action={action}
      className="rounded-xl border border-subtle bg-surface p-4"
    >
      <h2 className="text-[13px] font-extrabold tracking-[-0.08em]">Add someone</h2>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <input
          name="name"
          required
          maxLength={80}
          placeholder="Name"
          className={inputClass}
        />
        <input
          name="email"
          type="email"
          required
          maxLength={320}
          placeholder="Email"
          className={inputClass}
        />

        <select name="role" defaultValue="MEMBER" className={inputClass}>
          {ASSIGNABLE_ROLES.map((role) => (
            <option key={role.value} value={role.value}>
              {role.label}
            </option>
          ))}
        </select>

        <select name="dashboardId" defaultValue="" className={inputClass}>
          <option value="">No dashboard yet</option>
          {dashboards.map((dashboard) => (
            <option key={dashboard.id} value={dashboard.id}>
              Add to {dashboard.name}
            </option>
          ))}
        </select>

        <div className="flex gap-2 sm:col-span-2">
          <input
            ref={passwordRef}
            name="password"
            required
            minLength={8}
            placeholder="Password (8+ characters)"
            className={`${inputClass} flex-1`}
          />
          <button
            type="button"
            onClick={generate}
            className="shrink-0 rounded-lg border border-subtle px-3 text-[12px] font-semibold text-ink-secondary transition-colors hover:border-strong hover:text-ink"
          >
            Generate
          </button>
        </div>
      </div>

      {state.error && (
        <p
          role="alert"
          className="mt-3 text-[12.5px]"
          style={{ color: "var(--status-critical)" }}
        >
          {state.error}
        </p>
      )}
      {state.ok && (
        <p className="mt-3 text-[12.5px]" style={{ color: "var(--status-good)" }}>
          {state.ok} Copy the password before you leave this page — it cannot be
          read back.
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className={`${primaryButtonClass} mt-3`}
      >
        {pending ? "Creating…" : "Create login"}
      </button>
    </form>
  );
}
