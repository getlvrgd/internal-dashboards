import { signOut } from "@/app/actions/auth";
import { Logo } from "@/components/Logo";
import { requireSession } from "@/lib/access";

export const dynamic = "force-dynamic";

/**
 * Signed in, but not yet given a dashboard.
 *
 * A real page rather than a redirect loop back to the login form — the account works,
 * and telling someone their password was wrong when it was not is the fastest way to
 * generate a support message about nothing.
 */
export default async function NoAccessPage() {
  const session = await requireSession();

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-16">
      <Logo height={22} />
      <h1 className="mt-8 text-[22px] font-bold tracking-tight">
        Nothing here yet
      </h1>
      <p className="mt-2 text-[14px] text-ink-secondary">
        You&rsquo;re signed in as {session.name}, but you haven&rsquo;t been
        given a dashboard yet. Ask whoever set up your account to add you to one.
      </p>
      <form action={signOut} className="mt-6">
        <button className="rounded-full border border-subtle px-3 py-1.5 text-[12px] font-semibold">
          Sign out
        </button>
      </form>
    </div>
  );
}
