import Link from "next/link";

import { signOut } from "@/app/actions/auth";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { accessibleDashboards, requireSession } from "@/lib/access";
import { isTileColor } from "@/lib/options";

export const dynamic = "force-dynamic";

/**
 * The picker someone lands on when they have been given more than one dashboard.
 *
 * Only ever shown when it earns its place — homePathFor() sends anyone with exactly one
 * dashboard straight into it, because a directory listing a single card is a click that
 * teaches nothing.
 */
export default async function SwitchPage() {
  const session = await requireSession();
  const dashboards = await accessibleDashboards(session);

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-10">
      <header className="flex items-center gap-3">
        <Logo height={22} />
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <form action={signOut}>
            <button className="rounded-full border border-subtle px-3 py-1.5 text-[12px] font-semibold">
              Sign out
            </button>
          </form>
        </div>
      </header>

      <h1 className="mt-10 text-[26px] font-bold tracking-tight">
        Where to, {session.name.split(" ")[0]}?
      </h1>
      <p className="mt-1 text-[14px] text-ink-secondary">
        You have access to {dashboards.length} dashboards.
      </p>

      <ul className="mt-6 grid gap-3 sm:grid-cols-2">
        {dashboards.map((dashboard) => (
          <li key={dashboard.id}>
            <Link
              href={`/d/${dashboard.slug}`}
              className="block rounded-xl border border-subtle bg-surface p-4 transition-colors hover:border-strong"
            >
              <span
                aria-hidden
                className="mb-3 block h-1.5 w-10 rounded-full"
                style={{
                  background: isTileColor(dashboard.color)
                    ? `var(--tile-${dashboard.color})`
                    : "var(--border-subtle)",
                }}
              />
              <span className="block text-[16px] font-bold tracking-tight">
                {dashboard.name}
              </span>
              {dashboard.description && (
                <span className="mt-1 block text-[12.5px] text-ink-muted">
                  {dashboard.description}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
