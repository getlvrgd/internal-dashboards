"use client";

import { useState } from "react";

import { createClient, updateClient } from "@/app/actions/clients";
import type { QuickLink } from "@/lib/links";
import { CLIENT_STATUSES, TILE_COLORS } from "@/lib/options";

import { Field, inputClass, primaryButtonClass } from "./ui";

/**
 * Add or edit a client.
 *
 * The link rows are the only reason this is a client component: the list grows as you
 * fill it in, so there is always one blank pair waiting and no "add another" button to
 * hunt for. Rows left blank are dropped on the server.
 */
export function ClientForm({
  client,
}: {
  client?: {
    id: string;
    name: string;
    offerOwner: string | null;
    niche: string | null;
    status: string;
    color: string;
    notes: string | null;
    links: QuickLink[];
  };
}) {
  const [rows, setRows] = useState<QuickLink[]>(
    client?.links.length ? [...client.links, blank()] : [blank(), blank()],
  );

  const setRow = (index: number, patch: Partial<QuickLink>) => {
    setRows((current) => {
      const next = current.map((row, i) =>
        i === index ? { ...row, ...patch } : row,
      );
      // Keep exactly one spare row at the end, so filling the last one opens another.
      const last = next[next.length - 1];
      if (last.label !== "" || last.url !== "") next.push(blank());
      return next;
    });
  };

  return (
    <form
      action={client ? updateClient : createClient}
      className="space-y-4 rounded-xl border border-subtle bg-surface p-4"
    >
      {client && <input type="hidden" name="id" value={client.id} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Client name">
          <input
            name="name"
            defaultValue={client?.name ?? ""}
            required
            maxLength={120}
            className={inputClass}
          />
        </Field>

        <Field label="Offer owner">
          <input
            name="offerOwner"
            defaultValue={client?.offerOwner ?? ""}
            maxLength={120}
            placeholder="Who owns the offer"
            className={inputClass}
          />
        </Field>

        <Field label="Niche">
          <input
            name="niche"
            defaultValue={client?.niche ?? ""}
            maxLength={120}
            className={inputClass}
          />
        </Field>

        <Field label="Status">
          <select
            name="status"
            defaultValue={client?.status ?? "ONBOARDING"}
            className={inputClass}
          >
            {CLIENT_STATUSES.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Colour" hint="Grouping only — the name carries the meaning.">
          <select
            name="color"
            defaultValue={client?.color ?? TILE_COLORS[0].value}
            className={inputClass}
          >
            {TILE_COLORS.map((color) => (
              <option key={color.value} value={color.value}>
                {color.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <fieldset>
        <legend className="text-[13px] font-semibold text-ink-secondary">
          Quick links
        </legend>
        <p className="mt-0.5 text-[12px] text-ink-muted">
          Drive, Trello, ad account — anything worth one click.
        </p>

        <div className="mt-2 space-y-2">
          {rows.map((row, index) => (
            <div key={index} className="flex gap-2">
              <input
                name="linkLabel"
                value={row.label}
                onChange={(e) => setRow(index, { label: e.target.value })}
                placeholder="Google Drive"
                aria-label="Link label"
                maxLength={60}
                className={`${inputClass} sm:w-48`}
              />
              <input
                name="linkUrl"
                value={row.url}
                onChange={(e) => setRow(index, { url: e.target.value })}
                placeholder="https://…"
                aria-label="Link URL"
                maxLength={500}
                className={`${inputClass} flex-1`}
              />
            </div>
          ))}
        </div>
      </fieldset>

      <Field label="Notes">
        <textarea
          name="notes"
          defaultValue={client?.notes ?? ""}
          rows={4}
          maxLength={4000}
          className={inputClass}
        />
      </Field>

      <button type="submit" className={primaryButtonClass}>
        {client ? "Save client" : "Add client"}
      </button>
    </form>
  );
}

const blank = (): QuickLink => ({ label: "", url: "" });
