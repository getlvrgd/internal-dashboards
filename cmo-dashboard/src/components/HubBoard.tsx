"use client";

import Link from "next/link";
import { useState } from "react";

import {
  deleteDashboard,
  moveDashboard,
  setTemplate,
  updateDashboard,
} from "@/app/actions/dashboards";
import {
  DASHBOARD_STATUS,
  DASHBOARD_STATUSES,
  dashboardStatusLabel,
  isTileColor,
  TILE_COLORS,
} from "@/lib/options";

import { DangerButton } from "./DangerButton";
import { ghostButtonClass, inputClass, primaryButtonClass } from "./ui";

export type HubCard = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: string;
  color: string;
  isTemplate: boolean;
  clients: number;
  people: number;
  open: number;
  fillDone: number;
  fillTotal: number;
};

/**
 * The list of dashboards, readable by default and editable on a click.
 *
 * Same shape as the SOP library: one Edit button turns the whole page into fields
 * rather than each card carrying its own pencil. A dashboard's name, description,
 * status and colour are the things that actually get changed, and having to open
 * Settings on each one to change a colour was three navigations for a two-second edit.
 *
 * Editing does not replace Settings — that page still owns the same fields, because it
 * is where you land from inside a dashboard and it is the only place delete lives for
 * someone who got there directly.
 */
export function HubBoard({
  dashboards,
  canDelete,
}: {
  dashboards: HubCard[];
  canDelete: boolean;
}) {
  const [editing, setEditing] = useState(false);

  if (dashboards.length === 0) {
    return (
      <p className="mt-6 rounded-xl border border-dashed border-strong px-5 py-12 text-center text-[14px] text-ink-secondary">
        No dashboards yet. Create the first one.
      </p>
    );
  }

  return (
    <>
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setEditing(!editing)}
          className={editing ? primaryButtonClass : ghostButtonClass}
        >
          {editing ? "Done editing" : "Edit dashboards"}
        </button>
        {editing && (
          <span className="text-[12px] text-ink-muted">
            Change a name, description, status or colour, reorder them, or set which
            one new dashboards are cloned from.
          </span>
        )}
      </div>

      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {dashboards.map((dashboard, index) =>
          editing ? (
            <EditCard
              key={dashboard.id}
              dashboard={dashboard}
              canDelete={canDelete}
              first={index === 0}
              last={index === dashboards.length - 1}
            />
          ) : (
            <ReadCard key={dashboard.id} dashboard={dashboard} />
          ),
        )}
      </ul>
    </>
  );
}

function ReadCard({ dashboard }: { dashboard: HubCard }) {
  return (
    <li className="flex flex-col rounded-xl border border-subtle bg-surface p-4">
      <ColorBar color={dashboard.color} />

      <div className="flex items-start gap-2">
        <h2 className="min-w-0 flex-1 text-[16px] font-extrabold tracking-[-0.08em] text-pretty">
          {dashboard.name}
        </h2>
        <span className="flex shrink-0 flex-col items-end gap-1">
          <StatusChip status={dashboard.status} />
          {dashboard.isTemplate && <TemplateChip />}
        </span>
      </div>

      {dashboard.description && (
        <p className="mt-1 text-[12.5px] text-ink-muted text-pretty">
          {dashboard.description}
        </p>
      )}

      <dl className="mt-4 space-y-1.5 text-[12.5px]">
        <Row label="Open this week" value={dashboard.open} />
        <Row label="Clients" value={dashboard.clients} />
        <Row label="Can sign in" value={dashboard.people} />
        <Row
          label="SOP links filled"
          value={`${dashboard.fillDone}/${dashboard.fillTotal}`}
        />
      </dl>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-subtle pt-3">
        <Link
          href={`/d/${dashboard.slug}`}
          className="rounded-full bg-ink px-3 py-1.5 text-[12px] font-bold text-page"
        >
          Open
        </Link>
        <Link
          href={`/d/${dashboard.slug}/team`}
          className="rounded-full border border-subtle px-3 py-1.5 text-[12px] font-semibold"
        >
          People
        </Link>
        <Link
          href={`/d/${dashboard.slug}/settings`}
          className="ml-auto text-[12px] font-semibold text-ink-muted underline-offset-2 hover:text-ink hover:underline"
        >
          Settings
        </Link>
      </div>
    </li>
  );
}

function EditCard({
  dashboard,
  canDelete,
  first,
  last,
}: {
  dashboard: HubCard;
  canDelete: boolean;
  first: boolean;
  last: boolean;
}) {
  return (
    <li className="flex flex-col rounded-xl border border-accent-edge bg-surface p-4">
      <form
        action={updateDashboard.bind(null, dashboard.slug)}
        className="flex flex-1 flex-col gap-2"
      >
        {/* Tells the action this came from the hub, so a slug change does not bounce
            the whole page into that dashboard's settings. */}
        <input type="hidden" name="from" value="hub" />

        <label className="block">
          <span className="text-[10px] font-bold tracking-widest text-ink-muted uppercase">
            Name
          </span>
          <input
            name="name"
            required
            maxLength={80}
            defaultValue={dashboard.name}
            className={`${inputClass} mt-1 w-full font-semibold`}
          />
        </label>

        <label className="block">
          <span className="text-[10px] font-bold tracking-widest text-ink-muted uppercase">
            Description
          </span>
          <input
            name="description"
            maxLength={240}
            defaultValue={dashboard.description ?? ""}
            placeholder="What it's for, in one line."
            className={`${inputClass} mt-1 w-full`}
          />
        </label>

        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="text-[10px] font-bold tracking-widest text-ink-muted uppercase">
              Status
            </span>
            <select
              name="status"
              defaultValue={dashboard.status}
              className={`${inputClass} mt-1 w-full`}
            >
              {DASHBOARD_STATUSES.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-[10px] font-bold tracking-widest text-ink-muted uppercase">
              Colour
            </span>
            <select
              name="color"
              defaultValue={dashboard.color}
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

        <div className="mt-auto flex items-center gap-2 pt-2">
          <button type="submit" className={primaryButtonClass}>
            Save
          </button>
          <span className="ml-auto flex items-center gap-1">
            <ArrowButton
              formAction={moveDashboard.bind(null, dashboard.slug, "up")}
              label={`Move ${dashboard.name} up`}
              disabled={first}
            >
              ↑
            </ArrowButton>
            <ArrowButton
              formAction={moveDashboard.bind(null, dashboard.slug, "down")}
              label={`Move ${dashboard.name} down`}
              disabled={last}
            >
              ↓
            </ArrowButton>
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-subtle pt-2 text-[12px]">
          {dashboard.isTemplate ? (
            <span className="font-semibold text-accent">
              New dashboards clone this one
            </span>
          ) : (
            <button
              type="submit"
              formAction={setTemplate.bind(null, dashboard.slug)}
              className="font-semibold text-ink-muted underline-offset-2 hover:text-ink hover:underline"
            >
              Use as template
            </button>
          )}

          {/* Deleting is the owner's alone — a dashboard holds a team's whole year of
              work, so an admin does not get the same button. */}
          {canDelete && (
            <DangerButton
              formAction={deleteDashboard.bind(null, dashboard.slug)}
              confirm={`Delete ${dashboard.name} and everything in it — clients, tasks, KPIs, logins and access? This cannot be undone.`}
              className="ml-auto font-semibold text-critical underline-offset-2 hover:underline"
            >
              Delete
            </DangerButton>
          )}
        </div>
      </form>
    </li>
  );
}

/* --------------------------------------------------------------------- bits -- */

function ColorBar({ color }: { color: string }) {
  return (
    <span
      aria-hidden
      className="mb-3 block h-1.5 w-10 rounded-full"
      style={{
        background: isTileColor(color)
          ? `var(--tile-${color})`
          : "var(--border-subtle)",
      }}
    />
  );
}

/** Status wears its own tint; the label is always present, so colour is never alone. */
function StatusChip({ status }: { status: string }) {
  const tone =
    status === DASHBOARD_STATUS.LIVE
      ? "border border-subtle text-good"
      : status === DASHBOARD_STATUS.ARCHIVED
        ? "border border-subtle text-ink-muted"
        : "bg-accent-soft text-accent";
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-bold tracking-widest uppercase ${tone}`}
    >
      {dashboardStatusLabel(status)}
    </span>
  );
}

function TemplateChip() {
  return (
    <span
      title="New dashboards start from this one"
      className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-bold tracking-widest text-accent uppercase"
    >
      Template
    </span>
  );
}

function Row({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );
}

function ArrowButton({
  formAction,
  label,
  disabled,
  children,
}: {
  formAction: (formData: FormData) => void | Promise<void>;
  label: string;
  disabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      formAction={formAction}
      disabled={disabled}
      aria-label={label}
      className="grid size-7 place-items-center rounded-full border border-subtle text-[12px] text-ink-secondary transition-colors hover:border-strong hover:text-ink disabled:opacity-30"
    >
      {children}
    </button>
  );
}
