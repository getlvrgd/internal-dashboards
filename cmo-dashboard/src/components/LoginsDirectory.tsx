"use client";

import { useRef, useState, useTransition } from "react";

import {
  clearSecret,
  createCredential,
  deleteCredential,
  revealSecret,
  updateCredential,
} from "@/app/actions/credentials";
import { safeHref } from "@/lib/links";

import { DangerButton } from "./DangerButton";
import { EmptyNote, ghostButtonClass, inputClass, primaryButtonClass } from "./ui";

export type LoginRow = {
  id: string;
  service: string;
  url: string | null;
  identity: string | null;
  notes: string | null;
  hasSecret: boolean;
};

/**
 * One offer's logins, as cards.
 *
 * Modelled on the sales rep hub's version, because the job is the same: someone needs to
 * get into a tool right now, and the fastest path is a Copy button next to each field
 * rather than a table you select text out of.
 *
 * A password is never in the page until it is asked for. The list renders from rows that
 * were never decrypted; Show and Copy each fetch that one password on its own, which is
 * what keeps a screen-share of this page from being a leak of every account in it.
 */
export function LoginsDirectory({
  logins,
  clientId,
  clientName,
  dashboardSlug,
  editable,
  presets = [],
  offers = [],
}: {
  logins: LoginRow[];
  clientId: string;
  clientName: string;
  dashboardSlug: string;
  editable: boolean;
  /** Tools remembered from what has been saved before, anywhere. */
  presets?: { service: string; url: string | null }[];
  /**
   * Every offer a login could be filed against. The add form defaults to the one being
   * looked at, so the common case is untouched, but a login typed on the wrong screen
   * can be put where it belongs without starting again.
   */
  offers?: { id: string; name: string }[];
}) {
  return (
    <div>
      {logins.length === 0 ? (
        <EmptyNote>No logins saved for {clientName}.</EmptyNote>
      ) : (
        <p className="mb-2 text-[12px] text-ink-muted">
          {logins.length} {logins.length === 1 ? "login" : "logins"} for{" "}
          <span className="font-semibold text-ink-secondary">{clientName}</span>
        </p>
      )}

      {logins.length > 0 && (
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {logins.map((login) => (
            <LoginCard
              key={login.id}
              login={login}
              dashboardSlug={dashboardSlug}
              editable={editable}
            />
          ))}
        </div>
      )}


      {editable && (
        <details className="group mt-3">
          <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-[13px] font-semibold text-ink-muted transition-colors hover:text-ink">
            <span className="transition-transform group-open:rotate-90">›</span>
            Add new login
          </summary>

          <form
            action={createCredential.bind(null, dashboardSlug)}
            className="mt-3 grid gap-2 rounded-xl border border-subtle bg-surface p-3 sm:grid-cols-2"
          >
            {/* Which offer this login belongs to, always shown — a login is only
                useful filed against the right offer, and a control that appears once
                there are two offers is one nobody learns is there. Defaults to the
                offer being looked at, so the common case is still one glance. */}
            <label className="block sm:col-span-2">
              <span className="text-[10px] font-bold tracking-widest text-ink-muted uppercase">
                Offer this login belongs to
              </span>
              <select
                name="clientId"
                defaultValue={clientId}
                className={`${inputClass} mt-1 w-full`}
              >
                {(offers.length > 0
                  ? offers
                  : [{ id: clientId, name: clientName }]
                ).map((offer) => (
                  <option key={offer.id} value={offer.id}>
                    {offer.name}
                  </option>
                ))}
              </select>
            </label>
            <PresetFields presets={presets} />
            <input
              name="identity"
              placeholder="Email or username"
              className={inputClass}
            />
            <input
              name="secret"
              type="password"
              autoComplete="new-password"
              placeholder="Password"
              className={inputClass}
            />
            <input
              name="notes"
              placeholder="Notes — who to ask, security codes…"
              className={`${inputClass} sm:col-span-2`}
            />
            <div className="sm:col-span-2">
              <button type="submit" className={primaryButtonClass}>
                Save login
              </button>
            </div>
          </form>

          <p className="mt-2 text-[12px] text-ink-muted">
            The password is encrypted before it is stored and never shown in this list
            until someone asks for it.
          </p>
        </details>
      )}
    </div>
  );
}

function LoginCard({
  login,
  dashboardSlug,
  editable,
}: {
  login: LoginRow;
  dashboardSlug: string;
  editable: boolean;
}) {
  const href = login.url ? safeHref(login.url) : null;

  return (
    <div className="h-full rounded-xl border border-subtle bg-surface px-3.5 py-3">
      <span className="inline-block rounded border border-subtle px-1.5 py-0.5 text-[10px] font-bold tracking-widest text-ink-muted uppercase">
        Login
      </span>
      <h3 className="mt-2 text-[13.5px] font-extrabold tracking-[-0.08em]">
        {login.service}
      </h3>
      {login.notes && (
        <p className="mt-0.5 text-[12.5px] text-ink-muted">{login.notes}</p>
      )}

      <dl className="mt-3 space-y-1.5 text-[12.5px]">
        <Field label="URL" value={login.url} href={href} />
        <Field label="Email" value={login.identity} />
        <PasswordField
          id={login.id}
          dashboardSlug={dashboardSlug}
          hasSecret={login.hasSecret}
        />
      </dl>

      {editable && (
        <details className="group mt-3 border-t border-subtle pt-2">
          <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-[12px] font-semibold text-ink-muted transition-colors hover:text-ink">
            <span className="transition-transform group-open:rotate-90">›</span>
            Edit
          </summary>

          <form
            action={updateCredential.bind(null, dashboardSlug)}
            className="mt-2 grid gap-2"
          >
            <input type="hidden" name="id" value={login.id} />
            <input
              name="service"
              required
              defaultValue={login.service}
              className={inputClass}
            />
            <input
              name="url"
              defaultValue={login.url ?? ""}
              placeholder="https://"
              className={inputClass}
            />
            <input
              name="identity"
              defaultValue={login.identity ?? ""}
              placeholder="Email or username"
              className={inputClass}
            />
            <input
              name="secret"
              type="password"
              autoComplete="new-password"
              placeholder="New password (blank keeps it)"
              className={inputClass}
            />
            <input
              name="notes"
              defaultValue={login.notes ?? ""}
              placeholder="Notes"
              className={inputClass}
            />
            <div className="flex flex-wrap items-center gap-3">
              <button type="submit" className={ghostButtonClass}>
                Save
              </button>
              <button
                type="submit"
                formAction={clearSecret.bind(null, dashboardSlug)}
                className="text-[12px] font-semibold text-ink-muted underline-offset-2 hover:text-ink hover:underline"
              >
                Clear password
              </button>
              <DangerButton
                formAction={deleteCredential.bind(null, dashboardSlug)}
                confirm={`Delete the ${login.service} login?`}
                className="ml-auto text-[12px] font-semibold text-critical underline-offset-2 hover:underline"
              >
                Delete
              </DangerButton>
            </div>
          </form>
        </details>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  href,
}: {
  label: string;
  value: string | null;
  href?: string | null;
}) {
  if (!value) return null;
  return (
    <div className="flex items-center gap-2">
      <dt className="w-14 shrink-0 text-ink-muted">{label}</dt>
      <dd className="min-w-0 flex-1 truncate font-mono text-[12px]">
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noreferrer noopener"
            className="underline-offset-2 hover:underline"
          >
            {value}
          </a>
        ) : (
          value
        )}
      </dd>
      <CopyButton getValue={async () => value} />
    </div>
  );
}

/**
 * Tool and URL, with a preset picker in front of them.
 *
 * The list is learned from every login saved anywhere, so it fills itself instead of
 * needing a curated seed nobody maintains. Choosing one only fills the fields — it is a
 * shortcut, not a link, so correcting the URL here never edits anything else.
 */
function PresetFields({
  presets,
}: {
  presets: { service: string; url: string | null }[];
}) {
  const serviceRef = useRef<HTMLInputElement>(null);
  const urlRef = useRef<HTMLInputElement>(null);

  return (
    <>
      {presets.length > 0 && (
        <select
          defaultValue=""
          aria-label="Start from a saved tool"
          onChange={(event) => {
            const preset = presets.find((p) => p.service === event.target.value);
            if (!preset) return;
            if (serviceRef.current) serviceRef.current.value = preset.service;
            if (urlRef.current) urlRef.current.value = preset.url ?? "";
            event.target.value = "";
            serviceRef.current?.focus();
          }}
          className={`${inputClass} sm:col-span-2`}
        >
          <option value="">Start from a saved tool…</option>
          {presets.map((preset) => (
            <option key={preset.service} value={preset.service}>
              {preset.service}
            </option>
          ))}
        </select>
      )}

      <input
        ref={serviceRef}
        name="service"
        required
        placeholder="Tool — Google account, Close CRM…"
        className={inputClass}
      />
      <input
        ref={urlRef}
        name="url"
        placeholder="https://"
        className={inputClass}
      />
    </>
  );
}

/**
 * The password row.
 *
 * Show and Copy each go to the server for this one value. Copy deliberately does not
 * require revealing first — pasting into a login box is the common case, and it need
 * never put the password on screen at all.
 */
function PasswordField({
  id,
  dashboardSlug,
  hasSecret,
}: {
  id: string;
  dashboardSlug: string;
  hasSecret: boolean;
}) {
  const [shown, setShown] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!hasSecret) {
    return (
      <div className="flex items-center gap-2">
        <dt className="w-14 shrink-0 text-ink-muted">Password</dt>
        <dd className="flex-1 text-ink-muted">Not saved</dd>
      </div>
    );
  }

  const reveal = () => {
    if (shown) {
      setShown(null);
      return;
    }
    startTransition(async () => {
      const result = await revealSecret(dashboardSlug, id);
      if (result.error) setError(result.error);
      else setShown(result.value ?? "");
    });
  };

  return (
    <div className="flex items-center gap-2">
      <dt className="w-14 shrink-0 text-ink-muted">Password</dt>
      <dd className="min-w-0 flex-1 truncate font-mono text-[12px]">
        {shown ?? "•••••••••"}
      </dd>
      <button
        onClick={reveal}
        disabled={pending}
        className="shrink-0 text-[11px] font-semibold text-ink-muted underline underline-offset-2 hover:text-ink"
      >
        {shown ? "Hide" : "Show"}
      </button>
      <CopyButton
        getValue={async () => {
          const result = await revealSecret(dashboardSlug, id);
          return result.value ?? null;
        }}
      />
      {error && (
        <span className="text-[11px]" style={{ color: "var(--status-critical)" }}>
          {error}
        </span>
      )}
    </div>
  );
}

function CopyButton({ getValue }: { getValue: () => Promise<string | null> }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      onClick={async () => {
        const value = await getValue();
        if (!value) return;
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          // Clipboard needs a secure context and permission; failing quietly beats an
          // alert nobody can act on.
        }
      }}
      className="shrink-0 rounded-md border border-subtle px-2 py-0.5 text-[11px] font-semibold text-ink-secondary transition-colors hover:border-strong hover:text-ink"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
