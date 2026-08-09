import Link from "next/link";

import {
  resetPassword,
  setActive,
  setMembershipFromRoster,
  setPlatformRole,
} from "@/app/actions/people";
import { AddPersonForm } from "@/components/AddPersonForm";
import { AutoSubmitSelect } from "@/components/AutoSubmitSelect";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ghostButtonClass, inputClass } from "@/components/ui";
import { requireAdmin } from "@/lib/access";
import { prisma } from "@/lib/db";
import {
  ASSIGNABLE_ROLES,
  MEMBERSHIP_ROLE_OPTIONS,
  MEMBERSHIP_ROLES,
  roleLabel,
  ROLES,
} from "@/lib/options";

export const dynamic = "force-dynamic";

/**
 * One roster for every account, and what each one can reach.
 *
 * Deliberately one page rather than a Team tab per dashboard: the same person turns up
 * on several, and keeping a separate list per board is exactly how two of them end up
 * disagreeing about whether someone still works here. Which dashboards a person is on
 * is shown here but changed on that dashboard's own Team page, where the person
 * deciding is the one who knows.
 */
export default async function PeoplePage() {
  const session = await requireAdmin();

  const [people, dashboards] = await Promise.all([
    prisma.user.findMany({
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        memberships: {
          select: {
            role: true,
            dashboardId: true,
            dashboard: { select: { name: true, slug: true } },
          },
        },
      },
    }),
    prisma.dashboard.findMany({
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-8">
      <header className="flex flex-wrap items-center gap-3">
        <Link href="/hub" aria-label="All dashboards">
          <Logo height={22} />
        </Link>
        <span className="text-[13px] font-semibold">People</span>
        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/hub"
            className="rounded-full border border-subtle px-3 py-1.5 text-[12px] font-semibold"
          >
            Dashboards
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <h1 className="mt-8 text-[26px] font-bold tracking-tight">
        Everyone with a login
      </h1>
      <p className="mt-1 max-w-lg text-[14px] text-ink-secondary">
        Accounts are created here. Which dashboards someone can open is set on
        that dashboard&rsquo;s Team page.
      </p>

      <div className="mt-6">
        <AddPersonForm dashboards={dashboards} />
      </div>

      <ul className="mt-6 overflow-hidden rounded-xl border border-subtle bg-surface">
        {people.map((person) => {
          const isOwner = person.role === ROLES.OWNER;
          const isSelf = person.id === session.userId;
          const locked = isOwner || isSelf;

          return (
            <li
              key={person.id}
              className="border-t border-subtle px-3 py-3 first:border-t-0"
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold">
                    {person.name}
                    {!person.isActive && (
                      <span className="ml-2 text-[11px] font-bold tracking-widest text-ink-muted uppercase">
                        Deactivated
                      </span>
                    )}
                  </span>
                  <span className="block text-[12px] text-ink-muted">
                    {person.email}
                  </span>
                </span>

                {/* The owner's role is not editable by anyone, including themselves —
                    there must always be exactly one account that cannot be locked out. */}
                {locked ? (
                  <span className="shrink-0 text-[12px] font-semibold text-ink-muted">
                    {roleLabel(person.role)}
                    {isSelf && !isOwner && " · you"}
                  </span>
                ) : (
                  <form action={setPlatformRole}>
                    <input type="hidden" name="id" value={person.id} />
                    <AutoSubmitSelect
                      name="role"
                      value={person.role}
                      options={ASSIGNABLE_ROLES}
                      ariaLabel={`Role for ${person.name}`}
                    />
                  </form>
                )}

                {!locked && (
                  <form action={setActive}>
                    <input type="hidden" name="id" value={person.id} />
                    <button type="submit" className={ghostButtonClass}>
                      {person.isActive ? "Deactivate" : "Reactivate"}
                    </button>
                  </form>
                )}
              </div>

              {person.role === ROLES.OWNER || person.role === ROLES.ADMIN ? (
                <p className="mt-1.5 text-[12px] text-ink-muted">
                  Reaches every dashboard.
                </p>
              ) : (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {person.memberships.length === 0 && (
                    <span className="text-[12px] text-ink-muted">
                      No dashboards yet.
                    </span>
                  )}

                  {person.memberships.map((m) => (
                    <form
                      key={m.dashboard.slug}
                      action={setMembershipFromRoster}
                      className="flex items-center gap-1 rounded-full border border-subtle py-0.5 pr-1 pl-2.5"
                    >
                      <input type="hidden" name="userId" value={person.id} />
                      <input
                        type="hidden"
                        name="dashboardId"
                        value={m.dashboardId}
                      />
                      <span className="text-[12px] font-semibold">
                        {m.dashboard.name}
                      </span>
                      <AutoSubmitSelect
                        name="role"
                        value={m.role}
                        options={[
                          ...MEMBERSHIP_ROLE_OPTIONS,
                          { value: "", label: "Remove" },
                        ]}
                        ariaLabel={`${person.name} on ${m.dashboard.name}`}
                        className="bg-transparent text-[12px] text-ink-secondary"
                      />
                    </form>
                  ))}

                  {/* Everything they are not on yet. Choosing one grants Member, which
                      the chip above can then change — one control for the common case
                      rather than two for every case. */}
                  {dashboards.filter(
                    (d) => !person.memberships.some((m) => m.dashboardId === d.id),
                  ).length > 0 && (
                    <form
                      action={setMembershipFromRoster}
                      className="flex items-center"
                    >
                      <input type="hidden" name="userId" value={person.id} />
                      <input
                        type="hidden"
                        name="role"
                        value={MEMBERSHIP_ROLES.MEMBER}
                      />
                      <AutoSubmitSelect
                        name="dashboardId"
                        value=""
                        options={[
                          { value: "", label: "+ Add to a dashboard…" },
                          ...dashboards
                            .filter(
                              (d) =>
                                !person.memberships.some(
                                  (m) => m.dashboardId === d.id,
                                ),
                            )
                            .map((d) => ({ value: d.id, label: d.name })),
                        ]}
                        ariaLabel={`Add ${person.name} to a dashboard`}
                        className="rounded-full border border-dashed border-strong px-2.5 py-1 text-[12px] font-semibold text-ink-muted"
                      />
                    </form>
                  )}
                </div>
              )}

              {!isOwner && (
                <details className="group mt-1.5">
                  <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-[12px] font-semibold text-ink-muted transition-colors hover:text-ink">
                    <span className="transition-transform group-open:rotate-90">
                      ›
                    </span>
                    Set a new password
                  </summary>
                  <form action={resetPassword} className="mt-2 flex gap-2">
                    <input type="hidden" name="id" value={person.id} />
                    <input
                      name="password"
                      required
                      minLength={8}
                      placeholder="New password (8+ characters)"
                      className={`${inputClass} flex-1`}
                    />
                    <button type="submit" className={ghostButtonClass}>
                      Save
                    </button>
                  </form>
                </details>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
