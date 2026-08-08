import { redirect } from "next/navigation";

import { homePathFor, requireSession } from "@/lib/access";

export const dynamic = "force-dynamic";

/**
 * The front door. Decides where you belong and sends you there.
 *
 * Nothing renders here on purpose: the URL you hand someone is just the domain, and
 * what they see behind it is a question of who they are, not which link they were given.
 */
export default async function RootPage() {
  const session = await requireSession();
  redirect(await homePathFor(session));
}
