import {
  clearSecret,
  createCredential,
  deleteCredential,
  updateCredential,
} from "@/app/actions/credentials";
import { safeHref } from "@/lib/links";

import { DangerButton } from "./DangerButton";
import { SecretField } from "./SecretField";
import { EmptyNote, ghostButtonClass, inputClass, primaryButtonClass } from "./ui";

type CredentialRow = {
  id: string;
  service: string;
  url: string | null;
  identity: string | null;
  notes: string | null;
  secretCipher: string | null;
};

/**
 * A client's logins, on the client's own page.
 *
 * This is what replaced the company-wide vault. Logins differ per client, so a shared
 * folder was the wrong shape — and collapsing it into the client page means there is no
 * longer a route whose whole job is listing every password in the business.
 *
 * `secretCipher` is passed in only so the row can say whether a password exists. It is
 * never decrypted to render this: revealing one is a separate, deliberate request per
 * row, handled by SecretField.
 */
export function CredentialsPanel({
  credentials,
  clientId,
  clientName,
  dashboardSlug,
  editable,
}: {
  credentials: CredentialRow[];
  clientId: string;
  clientName: string;
  dashboardSlug: string;
  editable: boolean;
}) {
  return (
    <section>
      <h2 className="mb-2 text-[15px] font-bold tracking-tight">
        Logins
        <span className="ml-2 text-[13px] font-semibold text-ink-muted tabular">
          {credentials.length}
        </span>
      </h2>

      {credentials.length === 0 ? (
        <EmptyNote>No logins saved for {clientName}.</EmptyNote>
      ) : (
        <ul className="overflow-hidden rounded-xl border border-subtle bg-surface">
          {credentials.map((credential) => {
            const href = credential.url ? safeHref(credential.url) : null;
            return (
              <li
                key={credential.id}
                className="border-t border-subtle px-3 py-2.5 first:border-t-0"
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="text-[13px] font-semibold">
                    {href ? (
                      <a
                        href={href}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="underline-offset-2 hover:underline"
                      >
                        {credential.service}
                      </a>
                    ) : (
                      credential.service
                    )}
                  </span>

                  {credential.identity && (
                    <span className="text-[12.5px] text-ink-secondary">
                      {credential.identity}
                    </span>
                  )}

                  <span className="ml-auto flex items-center gap-2">
                    <SecretField
                      id={credential.id}
                      hasSecret={credential.secretCipher !== null}
                      dashboardSlug={dashboardSlug}
                    />
                  </span>
                </div>

                {credential.notes && (
                  <p className="mt-1 text-[12px] text-ink-muted">
                    {credential.notes}
                  </p>
                )}

                {editable && (
                  <details className="group mt-1.5">
                    <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-[12px] font-semibold text-ink-muted transition-colors hover:text-ink">
                      <span className="transition-transform group-open:rotate-90">
                        ›
                      </span>
                      Edit
                    </summary>

                    <form
                      action={updateCredential.bind(null, dashboardSlug)}
                      className="mt-2 grid gap-2 sm:grid-cols-2"
                    >
                      <input type="hidden" name="id" value={credential.id} />
                      <input
                        name="service"
                        required
                        defaultValue={credential.service}
                        placeholder="Service"
                        className={inputClass}
                      />
                      <input
                        name="url"
                        defaultValue={credential.url ?? ""}
                        placeholder="https://"
                        className={inputClass}
                      />
                      <input
                        name="identity"
                        defaultValue={credential.identity ?? ""}
                        placeholder="Email or username"
                        className={inputClass}
                      />
                      <input
                        name="secret"
                        type="password"
                        autoComplete="new-password"
                        placeholder="New password (leave blank to keep)"
                        className={inputClass}
                      />
                      <input
                        name="notes"
                        defaultValue={credential.notes ?? ""}
                        placeholder="Notes"
                        className={`${inputClass} sm:col-span-2`}
                      />
                      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
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
                          confirm={`Delete the ${credential.service} login? This cannot be undone.`}
                          className="ml-auto text-[12px] font-semibold text-critical underline-offset-2 hover:underline"
                        >
                          Delete
                        </DangerButton>
                      </div>
                    </form>
                  </details>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {editable && (
        <details className="group mt-3">
          <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-[13px] font-semibold text-ink-muted transition-colors hover:text-ink">
            <span className="transition-transform group-open:rotate-90">›</span>
            Add a login
          </summary>

          <form
            action={createCredential.bind(null, dashboardSlug)}
            className="mt-3 grid gap-2 rounded-xl border border-subtle bg-surface p-3 sm:grid-cols-2"
          >
            <input type="hidden" name="clientId" value={clientId} />
            <input
              name="service"
              required
              placeholder="Service — Kit, Gmail, GoDaddy…"
              className={inputClass}
            />
            <input name="url" placeholder="https://" className={inputClass} />
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
              placeholder="Notes"
              className={`${inputClass} sm:col-span-2`}
            />
            <div className="sm:col-span-2">
              <button type="submit" className={primaryButtonClass}>
                Save login
              </button>
            </div>
          </form>

          <p className="mt-2 text-[12px] text-ink-muted">
            The password is encrypted before it is stored, and is never shown in this
            list until you ask for one.
          </p>
        </details>
      )}
    </section>
  );
}
