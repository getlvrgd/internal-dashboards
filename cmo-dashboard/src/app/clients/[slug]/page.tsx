import Link from "next/link";
import { notFound } from "next/navigation";

import { deleteClient } from "@/app/actions/clients";
import { ClientForm } from "@/components/ClientForm";
import { DangerButton } from "@/components/DangerButton";
import { Nav } from "@/components/Nav";
import { Chip, Dot, EmptyNote, ghostButtonClass } from "@/components/ui";
import { requireSession } from "@/lib/access";
import { sessionCanEdit, sessionCanSeeCredentials } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { readQuickLinks, safeHref } from "@/lib/links";
import {
  clientStatusLabel,
  isTileColor,
  TASK_STATUS,
  taskStatusLabel,
  taskStatusTint,
} from "@/lib/options";

export const dynamic = "force-dynamic";

/** Everything filed against one client: links, open work, logins, notes. */
export default async function ClientPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const session = await requireSession();
  const editable = sessionCanEdit(session);
  const canSeeLogins = sessionCanSeeCredentials(session);
  const { slug } = await params;

  const client = await prisma.client.findUnique({
    where: { slug },
    include: {
      tasks: {
        where: { status: { not: TASK_STATUS.DONE } },
        orderBy: [{ weekOf: "asc" }, { day: "asc" }, { position: "asc" }],
        include: { assignee: { select: { name: true } } },
      },
      // Counted, never listed here — the values live behind the vault's own guard.
      _count: { select: { credentials: true } },
    },
  });
  if (!client) notFound();

  const links = readQuickLinks(client.links);
  const tinted = isTileColor(client.color);

  return (
    <>
      <Nav session={session} />

      <main className="mx-auto w-full max-w-4xl flex-1 px-5 py-6">
        <Link
          href="/clients"
          className="text-[13px] font-semibold text-ink-muted transition-colors hover:text-ink"
        >
          ‹ Clients
        </Link>

        <header className="mb-6 mt-2 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span
                aria-hidden
                className="size-3 shrink-0 rounded-full"
                style={{
                  background: tinted
                    ? `var(--tile-${client.color}-outline)`
                    : "var(--border-strong)",
                }}
              />
              <h1 className="truncate text-[22px] font-bold tracking-tight">
                {client.name}
              </h1>
              <Chip>{clientStatusLabel(client.status)}</Chip>
            </div>
            {(client.offerOwner || client.niche) && (
              <p className="mt-1 text-[13px] text-ink-secondary">
                {[client.offerOwner, client.niche].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>

          <Link href={`/?client=${client.id}`} className={ghostButtonClass}>
            See on the board
          </Link>
        </header>

        <div className="space-y-6">
          <section>
            <h2 className="mb-2 text-[15px] font-bold tracking-tight">Assets</h2>
            {links.length === 0 ? (
              <EmptyNote>
                No links yet.{editable && " Add them below."}
              </EmptyNote>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {links.map((link, index) => {
                  const href = safeHref(link.url);
                  return (
                    <li key={index}>
                      {href ? (
                        <a
                          href={href}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-subtle bg-surface px-3 py-1.5 text-[13px] font-semibold text-ink-secondary transition-colors hover:border-strong hover:text-ink"
                        >
                          {link.label}
                          <span aria-hidden className="text-ink-muted">
                            ↗
                          </span>
                        </a>
                      ) : (
                        <span
                          className="inline-flex rounded-lg border border-subtle px-3 py-1.5 text-[13px] text-ink-muted"
                          title="This link has no usable web address"
                        >
                          {link.label}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section>
            <h2 className="mb-2 text-[15px] font-bold tracking-tight">
              Open work
              <span className="ml-2 text-[13px] font-semibold text-ink-muted tabular">
                {client.tasks.length}
              </span>
            </h2>

            {client.tasks.length === 0 ? (
              <EmptyNote>Nothing outstanding.</EmptyNote>
            ) : (
              <ul className="overflow-hidden rounded-xl border border-subtle bg-surface">
                {client.tasks.map((task) => (
                  <li
                    key={task.id}
                    className="flex items-center gap-2 border-t border-subtle px-3 py-2 text-[13px] first:border-t-0"
                  >
                    <Dot tint={taskStatusTint(task.status)} />
                    <span className="min-w-0 flex-1 truncate">{task.title}</span>
                    {task.assignee && (
                      <span className="shrink-0 text-[12px] text-ink-muted">
                        {task.assignee.name}
                      </span>
                    )}
                    <span className="shrink-0 text-[12px] text-ink-muted">
                      {taskStatusLabel(task.status)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {canSeeLogins && (
            <section>
              <h2 className="mb-2 text-[15px] font-bold tracking-tight">Logins</h2>
              <p className="text-[13px] text-ink-secondary">
                {client._count.credentials === 0
                  ? "No logins saved for this client."
                  : `${client._count.credentials} saved.`}{" "}
                <Link
                  href={`/logins?client=${client.id}`}
                  className="font-semibold text-accent underline-offset-2 hover:underline"
                >
                  Open the vault
                </Link>
              </p>
            </section>
          )}

          {client.notes && (
            <section>
              <h2 className="mb-2 text-[15px] font-bold tracking-tight">Notes</h2>
              <p className="whitespace-pre-wrap rounded-xl border border-subtle bg-surface p-4 text-[13px] text-ink-secondary">
                {client.notes}
              </p>
            </section>
          )}

          {editable && (
            <details className="group">
              <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-[13px] font-semibold text-ink-muted transition-colors hover:text-ink">
                <span className="transition-transform group-open:rotate-90">›</span>
                Edit client
              </summary>

              <div className="mt-3 space-y-4">
                <ClientForm
                  client={{
                    id: client.id,
                    name: client.name,
                    offerOwner: client.offerOwner,
                    niche: client.niche,
                    status: client.status,
                    color: client.color,
                    notes: client.notes,
                    links,
                  }}
                />

                <form action={deleteClient}>
                  <input type="hidden" name="id" value={client.id} />
                  <DangerButton
                    confirm={`Delete ${client.name}? Their saved logins go too. Tasks are kept but lose the client.`}
                    className="text-[13px] font-semibold text-critical underline-offset-2 hover:underline"
                  >
                    Delete this client
                  </DangerButton>
                </form>
              </div>
            </details>
          )}
        </div>
      </main>
    </>
  );
}
