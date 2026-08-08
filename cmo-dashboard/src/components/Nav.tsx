import Link from "next/link";

import { signOut } from "@/app/actions/auth";
import type { Session } from "@/lib/auth";
import { canSeeCredentials, hasAdminAccess, roleLabel } from "@/lib/options";

import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
import { NavLink } from "./NavLink";

/**
 * The bar on every signed-in page.
 *
 * Links are filtered by role rather than rendered and disabled: a CMO account has no
 * business knowing the vault route exists. The server-side guard in src/lib/access.ts is
 * what actually enforces that — this only keeps the UI honest.
 */
export function Nav({ session }: { session: Session }) {
  const links = [
    { href: "/", label: "Board" },
    { href: "/clients", label: "Clients" },
    { href: "/sops", label: "SOPs" },
    ...(canSeeCredentials(session.role)
      ? [{ href: "/logins", label: "Logins" }]
      : []),
    ...(hasAdminAccess(session.role) ? [{ href: "/team", label: "Team" }] : []),
  ];

  return (
    <header className="sticky top-0 z-20 border-b border-subtle bg-page/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-5 py-3">
        <Link href="/" className="shrink-0" aria-label="CMO Dashboard">
          <Logo height={20} />
        </Link>

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
