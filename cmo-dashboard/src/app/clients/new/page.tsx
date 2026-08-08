import Link from "next/link";

import { ClientForm } from "@/components/ClientForm";
import { Nav } from "@/components/Nav";
import { requireSession } from "@/lib/access";
import { sessionCanEdit } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function NewClientPage() {
  const session = await requireSession();
  if (!sessionCanEdit(session)) redirect("/clients");

  return (
    <>
      <Nav session={session} />

      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-6">
        <Link
          href="/clients"
          className="text-[13px] font-semibold text-ink-muted transition-colors hover:text-ink"
        >
          ‹ Clients
        </Link>

        <h1 className="mb-5 mt-2 text-[22px] font-bold tracking-tight">
          Add a client
        </h1>

        <ClientForm />
      </main>
    </>
  );
}
