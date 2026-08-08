"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * A nav item that knows whether it is the page you are on.
 *
 * Split out of Nav so the bar itself can stay a server component — only the active-state
 * check needs the pathname, and shipping the whole header to the client to get it would
 * pull the sign-out action and the session label along with it.
 */
export function NavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  // "/" would otherwise match every route, so the root is compared exactly and the rest
  // by prefix — that way /clients/acme still lights up Clients.
  const active = href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`shrink-0 rounded-lg px-2.5 py-1.5 text-[13px] font-semibold transition-colors ${
        active
          ? "bg-accent-soft text-ink"
          : "text-ink-secondary hover:bg-accent-soft/60 hover:text-ink"
      }`}
    >
      {children}
    </Link>
  );
}
