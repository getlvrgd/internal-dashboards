import { resetPassword, setActive, setRole } from "@/app/actions/team";
import { AutoSubmitSelect } from "@/components/AutoSubmitSelect";
import { Nav } from "@/components/Nav";
import { Chip, ghostButtonClass, inputClass } from "@/components/ui";
import { requireAdmin } from "@/lib/access";
import { prisma } from "@/lib/db";
import { ASSIGNABLE_ROLES, roleLabel, ROLES } from "@/lib/options";

import { AddMemberForm } from "./AddMemberForm";

export const dynamic = "force-dynamic";

/** Who can sign in, and what they can reach. Owner and admins only. */
export default async function TeamPage() {
  const session = await requireAdmin();

  const users = await prisma.user.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });

  return (
    <>
      <Nav session={session} />

      <main className="mx-auto w-full max-w-4xl flex-1 px-5 py-6">
        <div className="mb-5">
          <h1 className="text-[22px] font-bold tracking-tight">Team</h1>
          <p className="mt-0.5 text-[13px] text-ink-secondary">
            A CMO account runs the board but cannot open the login vault. Only the
            owner and admins can.
          </p>
        </div>

        <div className="mb-8 overflow-hidden rounded-xl border border-subtle bg-surface">
          {users.map((user) => {
            const isOwnerRow = user.role === ROLES.OWNER;
            const isSelf = user.id === session.userId;
            // The owner's row and your own are read-only: there must always be one
            // account that cannot be demoted or switched off, and nobody should be able
            // to lock themselves out mid-session.
            const locked = isOwnerRow || isSelf;

            return (
              <div
                key={user.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-subtle px-3 py-3 first:border-t-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold">
                    {user.name}
                    {isSelf && (
                      <span className="ml-1.5 text-[12px] font-normal text-ink-muted">
                        you
                      </span>
                    )}
                  </p>
                  <p className="truncate text-[12px] text-ink-muted">{user.email}</p>
                </div>

                {!user.isActive && <Chip color="red">Deactivated</Chip>}

                {locked ? (
                  <Chip>{roleLabel(user.role)}</Chip>
                ) : (
                  <form action={setRole}>
                    <input type="hidden" name="id" value={user.id} />
                    <AutoSubmitSelect
                      name="role"
                      value={user.role}
                      ariaLabel={`Role for ${user.name}`}
                      options={ASSIGNABLE_ROLES.map((r) => ({
                        value: r.value,
                        label: roleLabel(r.value),
                      }))}
                      className={`${inputClass} w-32`}
                    />
                  </form>
                )}

                {!locked && (
                  <form action={setActive}>
                    <input type="hidden" name="id" value={user.id} />
                    <button type="submit" className={ghostButtonClass}>
                      {user.isActive ? "Deactivate" : "Reactivate"}
                    </button>
                  </form>
                )}

                <details className="group w-full">
                  <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-[12px] font-semibold text-ink-muted transition-colors hover:text-ink">
                    <span className="transition-transform group-open:rotate-90">›</span>
                    Set a new password
                  </summary>

                  <form action={resetPassword} className="mt-2 flex flex-wrap gap-2">
                    <input type="hidden" name="id" value={user.id} />
                    <input
                      name="password"
                      type="password"
                      minLength={8}
                      required
                      autoComplete="new-password"
                      placeholder="New password"
                      aria-label={`New password for ${user.name}`}
                      className={`${inputClass} max-w-xs flex-1`}
                    />
                    <button type="submit" className={ghostButtonClass}>
                      Set
                    </button>
                  </form>
                </details>
              </div>
            );
          })}
        </div>

        <h2 className="mb-2 text-[15px] font-bold tracking-tight">Add someone</h2>
        <AddMemberForm />
      </main>
    </>
  );
}
