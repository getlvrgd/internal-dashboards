import Link from "next/link";

import { setMembership } from "@/app/actions/people";
import { AutoSubmitSelect } from "@/components/AutoSubmitSelect";
import { Nav } from "@/components/Nav";
import { EmptyNote } from "@/components/ui";
import { requireDashboardManager } from "@/lib/access";
import { isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  hasAdminAccess,
  MEMBERSHIP_ROLE_OPTIONS,
  roleLabel,
  ROLES,
} from "@/lib/options";

export const dynamic = "force-dynamic";

/**
 * Who can open this dashboard.
 *
 * Accounts themselves are not created here — they live on one roster at /hub/people,
 * because the same person turns up on several dashboards and a separate list per board
 * is how two of them end up disagreeing about whether someone still works here. This
 * page only answers the question it is named for: of the people who exist, which ones
 * can open this one, and what may they do in it.
 */
export default async function TeamPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const context = await requireDashboardManager(slug);
  const { dashboard, session } = context;

  const [members, others] = await Promise.all([
    prisma.membership.findMany({
      where: { dashboardId: dashboard.id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isActive: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    // Everyone who could be added: ordinary accounts without a grant on this board.
    // Owners and admins are excluded because they already reach every dashboard, and a
    // membership row for them would be a second source of truth that could disagree.
    prisma.user.findMany({
      where: {
        isActive: true,
        role: { notIn: [ROLES.OWNER, ROLES.ADMIN] },
        memberships: { none: { dashboardId: dashboard.id } },
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true },
    }),
  ]);

  const admins = await prisma.user.findMany({
    where: { isActive: true, role: { in: [ROLES.OWNER, ROLES.ADMIN] } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true, role: true },
  });

  return (
    <>
      <Nav session={session} dashboard={dashboard} context={context} />

      <main className="mx-auto w-full max-w-4xl flex-1 px-5 py-6">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[22px] font-extrabold tracking-[-0.08em]">Team</h1>
            <p className="mt-0.5 text-[13px] text-ink-secondary">
              Who can open {dashboard.name}.
            </p>
          </div>
          {isAdmin(session) && (
            <Link
              href="/hub/people"
              className="text-[13px] font-semibold text-accent underline-offset-2 hover:underline"
            >
              Manage accounts →
            </Link>
          )}
        </div>

        <section className="mb-6">
          <h2 className="mb-2 text-[13px] font-extrabold tracking-[-0.08em]">
            On this dashboard
          </h2>

          {members.length === 0 ? (
            <EmptyNote>
              Nobody has been added yet. Owners and admins can always open it.
            </EmptyNote>
          ) : (
            <ul className="overflow-hidden rounded-xl border border-subtle bg-surface">
              {members.map((membership) => (
                <li
                  key={membership.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-subtle px-3 py-2.5 first:border-t-0"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-semibold">
                      {membership.user.name}
                      {!membership.user.isActive && (
                        <span className="ml-2 text-[11px] font-bold tracking-widest text-ink-muted uppercase">
                          Deactivated
                        </span>
                      )}
                    </span>
                    <span className="block text-[12px] text-ink-muted">
                      {membership.user.email}
                    </span>
                  </span>

                  <form action={setMembership.bind(null, slug)}>
                    <input
                      type="hidden"
                      name="userId"
                      value={membership.user.id}
                    />
                    <AutoSubmitSelect
                      name="role"
                      value={membership.role}
                      options={[
                        ...MEMBERSHIP_ROLE_OPTIONS,
                        { value: "", label: "Remove from dashboard" },
                      ]}
                      ariaLabel={`Role for ${membership.user.name}`}
                    />
                  </form>
                </li>
              ))}
            </ul>
          )}
        </section>

        {others.length > 0 && (
          <section className="mb-6">
            <h2 className="mb-2 text-[13px] font-extrabold tracking-[-0.08em]">
              Add someone
            </h2>
            <ul className="overflow-hidden rounded-xl border border-subtle bg-surface">
              {others.map((person) => (
                <li
                  key={person.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-subtle px-3 py-2.5 first:border-t-0"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-semibold">
                      {person.name}
                    </span>
                    <span className="block text-[12px] text-ink-muted">
                      {person.email}
                    </span>
                  </span>

                  <form action={setMembership.bind(null, slug)}>
                    <input type="hidden" name="userId" value={person.id} />
                    <AutoSubmitSelect
                      name="role"
                      value=""
                      options={[
                        { value: "", label: "Not on this dashboard" },
                        ...MEMBERSHIP_ROLE_OPTIONS,
                      ]}
                      ariaLabel={`Add ${person.name}`}
                    />
                  </form>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <h2 className="mb-2 text-[13px] font-extrabold tracking-[-0.08em]">
            Always has access
          </h2>
          <ul className="overflow-hidden rounded-xl border border-subtle bg-surface">
            {admins.map((person) => (
              <li
                key={person.id}
                className="flex items-center gap-3 border-t border-subtle px-3 py-2.5 text-[13px] first:border-t-0"
              >
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{person.name}</span>
                  <span className="block text-[12px] text-ink-muted">
                    {person.email}
                  </span>
                </span>
                <span className="shrink-0 text-[12px] text-ink-muted">
                  {roleLabel(person.role)}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[12px] text-ink-muted">
            {hasAdminAccess(session.role) &&
              "Owners and admins reach every dashboard by their account role, so they are not listed above."}
          </p>
        </section>
      </main>
    </>
  );
}
