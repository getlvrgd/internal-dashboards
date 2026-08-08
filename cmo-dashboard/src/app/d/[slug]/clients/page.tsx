import Link from "next/link";

import { Nav } from "@/components/Nav";
import { Chip, EmptyNote, primaryButtonClass } from "@/components/ui";
import { resolveDashboard } from "@/lib/access";
import { prisma } from "@/lib/db";
import { readQuickLinks } from "@/lib/links";
import { clientStatusLabel, isTileColor, TASK_STATUS } from "@/lib/options";

export const dynamic = "force-dynamic";

/**
 * Every client, with the one number that says whether they are being looked after: how
 * much of their work is still open.
 */
export default async function ClientsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const context = await resolveDashboard(slug);
  const { dashboard, session } = context;
  const editable = context.canEdit;

  const clients = await prisma.client.findMany({
    where: { dashboardId: dashboard.id },
    orderBy: [{ position: "asc" }, { name: "asc" }],
    include: {
      _count: {
        select: { tasks: { where: { status: { not: TASK_STATUS.DONE } } } },
      },
    },
  });

  return (
    <>
      <Nav session={session} dashboard={dashboard} context={context} />

      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-6">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[22px] font-bold tracking-tight">Clients</h1>
            <p className="mt-0.5 text-[13px] text-ink-secondary">
              Assets, links and logins, one card each.
            </p>
          </div>
          {editable && (
            <Link href={`/d/${slug}/clients/new`} className={primaryButtonClass}>
              Add client
            </Link>
          )}
        </div>

        {clients.length === 0 ? (
          <EmptyNote>
            No clients yet.
            {editable && " Add one to start filing assets and tasks against it."}
          </EmptyNote>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {clients.map((client) => {
              const links = readQuickLinks(client.links);
              const tinted = isTileColor(client.color);

              return (
                <Link
                  key={client.id}
                  href={`/d/${slug}/clients/${client.slug}`}
                  className="group rounded-xl border border-subtle bg-surface p-4 transition-colors hover:border-strong"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        aria-hidden
                        className="size-2.5 shrink-0 rounded-full"
                        style={{
                          background: tinted
                            ? `var(--tile-${client.color}-outline)`
                            : "var(--border-strong)",
                        }}
                      />
                      <h2 className="truncate text-[15px] font-bold tracking-tight">
                        {client.name}
                      </h2>
                    </div>
                    <Chip>{clientStatusLabel(client.status)}</Chip>
                  </div>

                  {(client.offerOwner || client.niche) && (
                    <p className="mt-1.5 truncate text-[12px] text-ink-secondary">
                      {[client.offerOwner, client.niche]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  )}

                  <p className="mt-3 text-[12px] text-ink-muted tabular">
                    {client._count.tasks} open{" "}
                    {client._count.tasks === 1 ? "task" : "tasks"}
                    {links.length > 0 && ` · ${links.length} links`}
                  </p>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}
