import Link from "next/link";
import { redirect } from "next/navigation";

import { ClientForm } from "@/components/ClientForm";
import { Nav } from "@/components/Nav";
import { resolveDashboard } from "@/lib/access";

export const dynamic = "force-dynamic";

export default async function NewClientPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const context = await resolveDashboard(slug);
  const { dashboard, session } = context;
  // Adding an offer is the owner's call, not a member's.
  if (!context.canManage) redirect(`/d/${slug}/clients`);

  return (
    <>
      <Nav session={session} dashboard={dashboard} context={context} />

      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-6">
        <Link
          href={`/d/${slug}/clients`}
          className="text-[13px] font-semibold text-ink-muted transition-colors hover:text-ink"
        >
          ‹ Clients
        </Link>

        <h1 className="mb-5 mt-2 text-[22px] font-bold tracking-tight">
          Add a client
        </h1>

        <ClientForm dashboardSlug={slug} />
      </main>
    </>
  );
}
