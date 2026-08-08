import Link from "next/link";

import { signOut } from "@/app/actions/auth";
import type { Session } from "@/lib/auth";
import { hasAdminAccess, roleLabel } from "@/lib/options";

import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
import { NavLink } from "./NavLink";

/**
 * The bar on every page inside a dashboard.
 *
 * Links are filtered by what this person may actually do rather than rendered and
 * disabled: an ordinary member has no business knowing the settings route exists. The
 * server-side guards in src/lib/access.ts are what enforce that — this only keeps the
 * UI honest.
 *
 * The dashboard's name sits beside the mark because there is now more than one of them,
 * and "which board am I looking at?" should never need a second's thought.
 */
export function Nav({
  session,
  dashboard,
  context,
}: {
  session: Session;
  dashboard: { name: string; slug: string };
  context: { canManage: boolean };
}) {
  const base = `/d/${dashboard.slug}`;
  const links = [
    { href: base, label: "Board" },
    { href: `${base}/clients`, label: "Clients" },
    { href: `${base}/sops`, label: "SOPs" },
    ...(context.canManage
      ? [
          { href: `${base}/team`, label: "Team" },
          { href: `${base}/settings`, label: "Settings" },
        ]
      : []),
  ];

  return (
    <header className="sticky top-0 z-20 border-b border-subtle bg-page/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-5 py-3">
        {/* For an owner or admin the mark goes back to the directory of every dashboard;
            for everyone else it goes to the board, which is as far as they can see. */}
        <Link
          href={hasAdminAccess(session.role) ? "/hub" : base}
          className="shrink-0"
          aria-label={
            hasAdminAccess(session.role) ? "All dashboards" : dashboard.name
          }
        >
          <Logo height={20} />
        </Link>

        <span className="hidden shrink-0 text-[13px] font-bold tracking-tight sm:inline">
          {dashboard.name}
        </span>

        <nav className="scroll-x flex min-w-0 flex-1 items-center gap-1">
          {links.map((link) => (
            <NavLink key={link.href} href={link.href}>
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <span
            className="hidden text-[12px] text-ink-muted sm:inline"
            title={`Signed in as ${session.name}`}
          >
            {session.name} · {roleLabel(session.role)}
          </span>
          <ThemeToggle />
          <form action={signOut}>
            <button
              type="submit"
              className="rounded-lg border border-subtle px-2 py-1 text-[12px] font-semibold text-ink-secondary transition-colors hover:border-strong hover:text-ink"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
