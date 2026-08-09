import Link from "next/link";

import { saveClientBoardLayout } from "@/app/actions/board";
import { deleteClient } from "@/app/actions/clients";
import { saveClientAssets } from "@/app/actions/sops";
import { BlockLibrary } from "@/components/BlockLibrary";
import { BoardShell } from "@/components/BoardShell";
import { CallsPanel } from "@/components/CallsPanel";
import { ClientForm } from "@/components/ClientForm";
import { DailyProgress } from "@/components/DailyProgress";
import { DangerButton } from "@/components/DangerButton";
import { LoginsDirectory } from "@/components/LoginsDirectory";
import { Nav } from "@/components/Nav";
import { TaskList } from "@/components/TaskList";
import type { RowOption } from "@/components/TaskRow";
import { TaskStoreProvider } from "@/components/TaskStore";
import { Chip, ghostButtonClass } from "@/components/ui";
import { resolveClient } from "@/lib/access";
import { DEFAULT_CLIENT_PANELS, parseBoardLayout } from "@/lib/board";
import { prisma } from "@/lib/db";
import { readQuickLinks, safeHref } from "@/lib/links";
import { clientStatusLabel, isTileColor } from "@/lib/options";
import { parseSopContent } from "@/lib/sops";
import type { BoardTask } from "@/lib/tasks";
import { parseWeekParam, thisMonday, todayIndex, weekParam } from "@/lib/week";

export const dynamic = "force-dynamic";

/**
 * One offer, as a board rather than a profile page.
 *
 * Everything about a client is here: what is happening, what to do, the calls, the asset
 * directory and the logins. It used to be a summary that linked elsewhere for each of
 * those, which meant several navigations to answer one question and a page nobody opened.
 *
 * The panels are the same machinery as the dashboard board, so the order and the
 * headings are yours — but only for someone who may manage the dashboard. A member sees
 * the board, works in it and switches between offers; the shape of the page is not
 * theirs to change, and should look the same to everyone reading it.
 */
export default async function ClientPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; client: string }>;
  searchParams: Promise<{ week?: string }>;
}) {
  const { slug, client: clientSlug } = await params;
  const context = await resolveClient(slug, clientSlug);
  const { dashboard, session, client } = context;
  const editable = context.canManage;

  const { week: weekParamValue } = await searchParams;
  const monday = parseWeekParam(weekParamValue);
  const week = weekParam(monday);
  const today = todayIndex(monday);

  const [tasks, credentials, calls, siblings, people] = await Promise.all([
    prisma.task.findMany({
      where: { clientId: client.id },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    }),
    context.canUseOfferLogins
      ? prisma.credential.findMany({
          where: { clientId: client.id },
          orderBy: [{ position: "asc" }, { createdAt: "asc" }],
        })
      : Promise.resolve([]),
    prisma.call.findMany({
      where: { clientId: client.id },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    }),
    // The switcher along the top. An offer board is somewhere you move between, so the
    // other offers are one click away rather than a trip back to the list.
    prisma.client.findMany({
      where: { dashboardId: dashboard.id, status: { not: "CHURNED" } },
      orderBy: [{ position: "asc" }, { name: "asc" }],
      select: { id: true, name: true, slug: true, color: true },
    }),
    prisma.user.findMany({
      where: {
        isActive: true,
        OR: [
          { memberships: { some: { dashboardId: dashboard.id } } },
          { role: { in: ["OWNER", "ADMIN"] } },
        ],
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const presets = context.canManage
    ? await prisma.loginPreset.findMany({
        orderBy: { service: "asc" },
        select: { service: true, url: true },
      })
    : [];

  const clientOptions: RowOption[] = [
    { value: client.id, label: client.name, color: client.color },
  ];
  const peopleOptions: RowOption[] = people.map((p) => ({
    value: p.id,
    label: p.name,
  }));

  const boardTasks: BoardTask[] = tasks.map((task) => ({
    id: task.id,
    title: task.title,
    status: task.status,
    priority: task.priority,
    recurring: task.recurring,
    clientId: task.clientId,
    assigneeId: task.assigneeId,
    day: task.day,
    weekOf: task.weekOf ? weekParam(task.weekOf) : null,
    position: task.position,
  }));

  const links = readQuickLinks(client.links);
  const tinted = isTileColor(client.color);
  const layout = parseBoardLayout(client.boardLayout, DEFAULT_CLIENT_PANELS);
  const isCurrentWeek = monday.getTime() === thisMonday().getTime();

  return (
    <>
      <Nav session={session} dashboard={dashboard} context={context} />

      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-6">
        <Link
          href={`/d/${slug}/clients`}
          className="text-[13px] font-semibold text-ink-muted transition-colors hover:text-ink"
        >
          ‹ Clients
        </Link>

        <header className="mt-2 mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span
                aria-hidden
                className="size-3 shrink-0 rounded-full"
                style={{
                  background: tinted
                    ? `var(--tile-${client.color})`
                    : "var(--border-subtle)",
                }}
              />
              <h1 className="text-[24px] font-bold tracking-tight">
                {client.name}
              </h1>
              <Chip color={tinted ? client.color : "blue"}>
                {clientStatusLabel(client.status)}
              </Chip>
            </div>
            {(client.offerOwner || client.niche) && (
              <p className="mt-0.5 text-[13px] text-ink-secondary">
                {[client.offerOwner, client.niche].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>

          {!isCurrentWeek && (
            <Link
              href={`/d/${slug}/clients/${clientSlug}`}
              className={ghostButtonClass}
            >
              Back to this week
            </Link>
          )}
        </header>

        {/* Switch offers without going back to the list. */}
        {siblings.length > 1 && (
          <div className="scroll-x mb-5 flex items-center gap-1.5 pb-1">
            {siblings.map((sibling) => (
              <Link
                key={sibling.id}
                href={`/d/${slug}/clients/${sibling.slug}`}
                aria-current={sibling.id === client.id ? "page" : undefined}
                className={`shrink-0 rounded-full border px-2.5 py-1 text-[12px] font-semibold transition-colors ${
                  sibling.id === client.id
                    ? "border-accent-edge bg-accent-soft text-ink"
                    : "border-subtle text-ink-secondary hover:border-strong hover:text-ink"
                }`}
              >
                {sibling.name}
              </Link>
            ))}
          </div>
        )}

        {links.length > 0 && (
          <div className="mb-5 flex flex-wrap gap-1.5">
            {links.map((link, i) => {
              const href = safeHref(link.url);
              return href ? (
                <a
                  key={i}
                  href={href}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="rounded-full border border-subtle px-2.5 py-1 text-[12px] font-semibold text-ink-secondary transition-colors hover:border-strong hover:text-ink"
                >
                  {link.label || href}
                </a>
              ) : null;
            })}
          </div>
        )}

        <TaskStoreProvider
          tasks={boardTasks}
          dashboardSlug={slug}
          week={week}
          canManage={editable}
          canTick={context.canTick}
        >
          <BoardShell
            initialPanels={layout.panels}
            defaultPanels={DEFAULT_CLIENT_PANELS}
            onSave={saveClientBoardLayout.bind(null, slug, clientSlug)}
            editable={context.canManage}
            slots={{
              progress: <DailyProgress today={today} />,

              todo: (
                <div className="overflow-hidden rounded-xl border border-subtle bg-surface">
                  <TaskList
                    scope={{ kind: "today", today }}
                    clients={clientOptions}
                    people={peopleOptions}
                    emptyNote="Nothing outstanding for this offer."
                    defaultClientId={client.id}
                  />
                </div>
              ),

              calls: (
                <CallsPanel
                  calls={calls}
                  dashboardSlug={slug}
                  clientId={client.id}
                  editable={editable}
                />
              ),

              assets: (
                <BlockLibrary
                  content={parseSopContent(client.assetsContent)}
                  save={saveClientAssets.bind(null, slug, clientSlug)}
                  canEdit={context.canManage}
                  emptyNote="No assets filed for this offer yet."
                />
              ),

              logins: context.canUseOfferLogins ? (
                <LoginsDirectory
                  logins={credentials.map((c) => ({
                    id: c.id,
                    service: c.service,
                    url: c.url,
                    identity: c.identity,
                    notes: c.notes,
                    hasSecret: c.secretCipher !== null,
                  }))}
                  clientId={client.id}
                  clientName={client.name}
                  dashboardSlug={slug}
                  editable={editable}
                  presets={presets}
                />
              ) : (
                <p className="text-[13px] text-ink-muted">
                  You do not have access to this offer&rsquo;s logins.
                </p>
              ),
            }}
          />
        </TaskStoreProvider>

        {editable && (
          <details className="group mt-8">
            <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-[13px] font-semibold text-ink-muted transition-colors hover:text-ink">
              <span className="transition-transform group-open:rotate-90">›</span>
              Offer details
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
                dashboardSlug={slug}
              />

              <form action={deleteClient.bind(null, slug)}>
                <input type="hidden" name="id" value={client.id} />
                <DangerButton
                  confirm={`Delete ${client.name}? Their logins, assets and calls go too. Tasks are kept but lose the client.`}
                  className="text-[13px] font-semibold text-critical underline-offset-2 hover:underline"
                >
                  Delete this client
                </DangerButton>
              </form>
            </div>
          </details>
        )}
      </main>
    </>
  );
}
