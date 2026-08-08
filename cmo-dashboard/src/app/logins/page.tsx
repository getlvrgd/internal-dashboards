import Link from "next/link";

import {
  clearSecret,
  createCredential,
  deleteCredential,
  updateCredential,
} from "@/app/actions/credentials";
import { Nav } from "@/components/Nav";
import { SecretField } from "@/components/SecretField";
import {
  Chip,
  EmptyNote,
  ghostButtonClass,
  inputClass,
  primaryButtonClass,
} from "@/components/ui";
import { requireVaultAccess } from "@/lib/access";
import { prisma } from "@/lib/db";
import { safeHref } from "@/lib/links";
import { vaultConfigured } from "@/lib/secrets";

export const dynamic = "force-dynamic";

/**
 * The login directory.
 *
 * Owner and admin only — requireVaultAccess() is what enforces that, and it runs before
 * a single row is read. Passwords are stored encrypted and are never rendered into this
 * page; each row asks for its own on click. See src/lib/secrets.ts for what that does
 * and does not protect against.
 */
export default async function LoginsPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string }>;
}) {
  const session = await requireVaultAccess();
  const { client: clientFilter = "" } = await searchParams;
  const configured = vaultConfigured();

  const [credentials, clients] = await Promise.all([
    prisma.credential.findMany({
      where: clientFilter ? { clientId: clientFilter } : {},
      orderBy: [{ clientId: "asc" }, { position: "asc" }, { service: "asc" }],
      // An explicit select, so secretCipher is left out by construction rather than by
      // remembering to strip it — a ciphertext has no business in a rendered payload.
      select: {
        id: true,
        service: true,
        url: true,
        identity: true,
        notes: true,
        clientId: true,
        client: { select: { name: true, color: true } },
      },
    }),
    prisma.client.findMany({
      orderBy: [{ position: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
  ]);

  // Which rows have a password is not itself a secret, and the UI needs it to decide
  // between a Reveal button and "no password saved".
  const filled = new Set(
    (
      await prisma.credential.findMany({
        where: {
          ...(clientFilter ? { clientId: clientFilter } : {}),
          NOT: { secretCipher: null },
        },
        select: { id: true },
      })
    ).map((row) => row.id),
  );

  return (
    <>
      <Nav session={session} />

      <main className="mx-auto w-full max-w-4xl flex-1 px-5 py-6">
        <div className="mb-4">
          <h1 className="text-[22px] font-bold tracking-tight">Logins</h1>
          <p className="mt-0.5 text-[13px] text-ink-secondary">
            Owner and admins only. Passwords are encrypted at rest and shown one at a
            time.
          </p>
        </div>

        {!configured && (
          <p
            role="alert"
            className="mb-4 rounded-xl border px-4 py-3 text-[13px]"
            style={{
              borderColor: "var(--tile-red-edge)",
              background: "var(--tile-red)",
            }}
          >
            <strong>CREDENTIAL_KEY is not set.</strong> Passwords cannot be saved or
            read until it is. Set it in the environment (32+ characters), then reload.
          </p>
        )}

        {clients.length > 0 && (
          <div className="scroll-x mb-4 flex gap-1.5 pb-1">
            <FilterChip href="/logins" active={!clientFilter}>
              All
            </FilterChip>
            {clients.map((client) => (
              <FilterChip
                key={client.id}
                href={`/logins?client=${client.id}`}
                active={clientFilter === client.id}
              >
                {client.name}
              </FilterChip>
            ))}
          </div>
        )}

        {credentials.length === 0 ? (
          <EmptyNote>No logins saved yet.</EmptyNote>
        ) : (
          <div className="overflow-hidden rounded-xl border border-subtle bg-surface">
            {credentials.map((credential) => {
              const href = credential.url ? safeHref(credential.url) : null;

              return (
                <div
                  key={credential.id}
                  className="border-t border-subtle px-3 py-3 first:border-t-0"
                >
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-[13px] font-bold">
                        {credential.service}
                      </span>
                      {credential.client && (
                        <Chip color={credential.client.color}>
                          {credential.client.name}
                        </Chip>
                      )}
                      {href && (
                        <a
                          href={href}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="shrink-0 text-[12px] font-semibold text-accent underline-offset-2 hover:underline"
                        >
                          Open ↗
                        </a>
                      )}
                    </div>

                    <span className="min-w-0 flex-1 truncate text-[12px] text-ink-secondary">
                      {credential.identity || "No email or username"}
                    </span>

                    <SecretField
                      id={credential.id}
                      hasSecret={filled.has(credential.id)}
                    />
                  </div>

                  {credential.notes && (
                    <p className="mt-1.5 text-[12px] text-ink-muted">
                      {credential.notes}
                    </p>
                  )}

                  <details className="group mt-1.5">
                    <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-[12px] font-semibold text-ink-muted transition-colors hover:text-ink">
                      <span className="transition-transform group-open:rotate-90">
                        ›
                      </span>
                      Edit
                    </summary>

                    <form action={updateCredential} className="mt-2 space-y-2">
                      <input type="hidden" name="id" value={credential.id} />

                      <div className="flex flex-wrap gap-2">
                        <input
                          name="service"
                          defaultValue={credential.service}
                          required
                          aria-label="Service"
                          className={`${inputClass} min-w-32 flex-1`}
                        />
                        <input
                          name="url"
                          defaultValue={credential.url ?? ""}
                          placeholder="https://…"
                          aria-label="URL"
                          className={`${inputClass} min-w-40 flex-1`}
                        />
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <input
                          name="identity"
                          defaultValue={credential.identity ?? ""}
                          placeholder="Email or username"
                          aria-label="Email or username"
                          autoComplete="off"
                          className={`${inputClass} min-w-40 flex-1`}
                        />
                        <input
                          name="secret"
                          type="password"
                          placeholder="New password — blank leaves it unchanged"
                          aria-label="New password"
                          autoComplete="new-password"
                          className={`${inputClass} min-w-40 flex-1`}
                        />
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <select
                          name="clientId"
                          defaultValue={credential.clientId ?? ""}
                          aria-label="Client"
                          className={`${inputClass} w-44`}
                        >
                          <option value="">Company-wide</option>
                          {clients.map((client) => (
                            <option key={client.id} value={client.id}>
                              {client.name}
                            </option>
                          ))}
                        </select>
                        <input
                          name="notes"
                          defaultValue={credential.notes ?? ""}
                          placeholder="Notes"
                          aria-label="Notes"
                          className={`${inputClass} min-w-40 flex-1`}
                        />
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button type="submit" className={ghostButtonClass}>
                          Save
                        </button>
                        <button
                          type="submit"
                          formAction={clearSecret}
                          className="rounded-full px-3 py-2 text-[13px] font-semibold text-ink-muted transition-colors hover:text-ink"
                        >
                          Clear password
                        </button>
                        <button
                          type="submit"
                          formAction={deleteCredential}
                          className="rounded-full px-3 py-2 text-[13px] font-semibold text-ink-muted transition-colors hover:text-critical"
                        >
                          Delete
                        </button>
                      </div>
                    </form>
                  </details>
                </div>
              );
            })}
          </div>
        )}

        <section className="mt-6">
          <h2 className="mb-2 text-[15px] font-bold tracking-tight">Add a login</h2>

          <form
            action={createCredential}
            className="space-y-2 rounded-xl border border-subtle bg-surface p-3"
          >
            <div className="flex flex-wrap gap-2">
              <input
                name="service"
                required
                placeholder="Service — Kit, GoDaddy, Gmail…"
                aria-label="Service"
                className={`${inputClass} min-w-40 flex-1`}
              />
              <input
                name="url"
                placeholder="https://…"
                aria-label="URL"
                className={`${inputClass} min-w-40 flex-1`}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <input
                name="identity"
                placeholder="Email or username"
                aria-label="Email or username"
                autoComplete="off"
                className={`${inputClass} min-w-40 flex-1`}
              />
              <input
                name="secret"
                type="password"
                placeholder="Password"
                aria-label="Password"
                autoComplete="new-password"
                className={`${inputClass} min-w-40 flex-1`}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <select
                name="clientId"
                defaultValue={clientFilter}
                aria-label="Client"
                className={`${inputClass} w-44`}
              >
                <option value="">Company-wide</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
              <input
                name="notes"
                placeholder="Notes"
                aria-label="Notes"
                className={`${inputClass} min-w-40 flex-1`}
              />
              <button
                type="submit"
                disabled={!configured}
                className={primaryButtonClass}
              >
                Add login
              </button>
            </div>
          </form>
        </section>

        <p className="mt-6 text-[12px] text-ink-muted">
          Encryption protects the stored data, not this screen. Anyone signed in as an
          owner or admin can reveal any password here — for accounts that should outlive
          a team change, keep a password manager as the source of truth.
        </p>
      </main>
    </>
  );
}

function FilterChip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={`shrink-0 rounded-full border px-2.5 py-1 text-[12px] font-semibold transition-colors ${
        active
          ? "border-accent-edge bg-accent-soft text-ink"
          : "border-subtle text-ink-secondary hover:border-strong hover:text-ink"
      }`}
    >
      {children}
    </Link>
  );
}
