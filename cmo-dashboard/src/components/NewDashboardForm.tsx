"use client";

import { useActionState, useState } from "react";

import {
  createDashboard,
  type DashboardFormState,
} from "@/app/actions/dashboards";
import { TILE_COLORS } from "@/lib/options";

import { inputClass, primaryButtonClass } from "./ui";

/**
 * "Add dashboard", as a disclosure rather than its own page.
 *
 * Creating one is four fields, and a route for that would mean a page you land on, fill
 * in and leave — three navigations for something that belongs beside the list it adds to.
 *
 * The copy-from picker defaults to the template, because a dashboard cloned from one
 * that already works is the case that actually happens; "start from scratch" is there
 * for the first genuinely different tool.
 */
export function NewDashboardForm({
  copyOptions,
  templateName,
}: {
  copyOptions: { id: string; name: string }[];
  templateName: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<
    DashboardFormState,
    FormData
  >(createDashboard, {});

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className={primaryButtonClass}>
        + Add dashboard
      </button>
    );
  }

  return (
    <form
      action={action}
      className="w-full rounded-xl border border-subtle bg-surface p-4 sm:w-[26rem]"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[13px] font-bold tracking-tight">New dashboard</h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-[12px] font-semibold text-ink-muted hover:text-ink"
        >
          Cancel
        </button>
      </div>

      <div className="mt-3 space-y-2.5">
        <label className="block">
          <span className="text-[11px] font-bold tracking-widest text-ink-muted uppercase">
            Name
          </span>
          <input
            name="name"
            required
            maxLength={80}
            autoFocus
            placeholder="Ops Dashboard"
            className={`${inputClass} mt-1 w-full`}
          />
        </label>

        <label className="block">
          <span className="text-[11px] font-bold tracking-widest text-ink-muted uppercase">
            Description
          </span>
          <input
            name="description"
            maxLength={240}
            placeholder="What it's for, in one line."
            className={`${inputClass} mt-1 w-full`}
          />
        </label>

        <div className="grid grid-cols-2 gap-2.5">
          <label className="block">
            <span className="text-[11px] font-bold tracking-widest text-ink-muted uppercase">
              Start from
            </span>
            <select
              name="copyFromId"
              defaultValue=""
              className={`${inputClass} mt-1 w-full`}
            >
              {copyOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                  {option.name === templateName ? " (template)" : ""}
                </option>
              ))}
              <option value="">Start from scratch</option>
            </select>
          </label>

          <label className="block">
            <span className="text-[11px] font-bold tracking-widest text-ink-muted uppercase">
              Colour
            </span>
            <select
              name="color"
              defaultValue={TILE_COLORS[0].value}
              className={`${inputClass} mt-1 w-full`}
            >
              {TILE_COLORS.map((color) => (
                <option key={color.value} value={color.value}>
                  {color.label}
                </option>
              ))}
            </select>
          </label>
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

      <button
        type="submit"
        disabled={pending}
        className={`${primaryButtonClass} mt-3 w-full`}
      >
        {pending ? "Creating…" : "Create dashboard"}
      </button>

      <p className="mt-2 text-[12px] text-ink-muted">
        It starts as a draft, so you can fill it in before anyone else sees it.
      </p>
    </form>
  );
}
