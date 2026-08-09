import "server-only";

import { notFound, redirect } from "next/navigation";

import {
  getSession,
  isAdmin,
  isOwner,
  sessionCanEdit,
  type Session,
} from "./auth";
import { prisma } from "./db";
import {
  DASHBOARD_STATUS,
  MEMBERSHIP_ROLES,
  membershipCanEdit,
  membershipCanSeeCredentials,
  ROLES,
} from "./options";

/**
 * The guards every page and every server action goes through.
 *
 * Two rules, enforced here rather than at each call site:
 *
 *   1. An owner or admin reaches every dashboard. Everyone else reaches exactly the
 *      dashboards they hold a Membership for, and asking for one they do not hold
 *      returns a 404 — not a redirect — so the app never confirms it exists.
 *
 *   2. Nothing downstream is trusted to remember `where: { dashboardId }`. A page gets
 *      its dashboard from resolveDashboard(), and a write gets it from
 *      requireDashboardWrite(), which re-checks the id against the session instead of
 *      believing the hidden field in the form that posted it.
 *
 * Hiding a nav link is never the control; these functions are.
 */

/** True until an owner exists. Only /setup asks. */
export async function needsSetup() {
  const owner = await prisma.user.findFirst({
    where: { role: ROLES.OWNER },
    select: { id: true },
  });
  return owner === null;
}

/**
 * The session, or a redirect. Sends a first-run visitor to /setup rather than a login
 * form no account can yet pass.
 */
export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (session) return session;
  if (await needsSetup()) redirect("/setup");
  redirect("/login");
}

/** The owner hub. Admins and the owner only. */
export async function requireAdmin(): Promise<Session> {
  const session = await requireSession();
  if (!isAdmin(session)) redirect("/");
  return session;
}

/**
 * Signed in as the owner. Guards deleting a dashboard, which no admin may do.
 *
 * The owner-only button being hidden from admins is a courtesy, not the control — a
 * replayed form post from an admin lands here.
 */
export async function requireOwner(): Promise<Session> {
  const session = await requireSession();
  if (!isOwner(session)) redirect("/");
  return session;
}

export type DashboardContext = {
  session: Session;
  dashboard: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    status: string;
    color: string;
    isTemplate: boolean;
    sopContent: unknown;
    boardLayout: unknown;
    revenueGoalCents: number;
  };
  /** MANAGER for owners and admins; otherwise whatever the Membership says. */
  role: string;
  /**
   * Full edit: create and delete anything on this dashboard, rearrange it, manage its
   * people. Owners, admins and per-dashboard managers only.
   *
   * This is the default for every write. A member is on the dashboard to do the work,
   * not to reshape it, so anything not explicitly loosened below is closed to them.
   */
  canManage: boolean;
  /**
   * Tick a task off. The one write an ordinary member has — it is the thing they are
   * here for, and it cannot destroy anything.
   */
  canTick: boolean;
  /**
   * Add to the SOP library. Members may add procedures but never remove one; the
   * no-deletions rule is enforced on save in src/app/actions/sops.ts, because a whole
   * document is posted and only a diff can tell an addition from a deletion.
   */
  canContribute: boolean;
  /** May open logins across the whole dashboard. Managers only. */
  canSeeCredentials: boolean;
  /**
   * May open the logins of one offer, on that offer's own page.
   *
   * Deliberately narrower than the above: every offer has different logins, so a member
   * working on one should reach its accounts without that becoming a list of every
   * account in the business on the main board.
   */
  canUseOfferLogins: boolean;
};

const DASHBOARD_FIELDS = {
  id: true,
  name: true,
  slug: true,
  description: true,
  status: true,
  color: true,
  isTemplate: true,
  sopContent: true,
  boardLayout: true,
  revenueGoalCents: true,
} as const;

/**
 * Resolves `/d/<slug>` for the current user.
 *
 * An archived dashboard closes to its members but stays open to owners and admins —
 * otherwise someone with the URL bookmarked would carry on working a dashboard that has
 * been retired, and the person who retired it could not get back in to finish the job.
 */
export async function resolveDashboard(
  slug: string,
): Promise<DashboardContext> {
  const session = await requireSession();

  const dashboard = await prisma.dashboard.findUnique({
    where: { slug },
    select: DASHBOARD_FIELDS,
  });
  if (!dashboard) notFound();

  const admin = isAdmin(session);

  let role: string;
  if (admin) {
    role = MEMBERSHIP_ROLES.MANAGER;
  } else {
    const membership = await prisma.membership.findUnique({
      where: {
        userId_dashboardId: {
          userId: session.userId,
          dashboardId: dashboard.id,
        },
      },
      select: { role: true },
    });
    if (!membership) notFound();
    if (dashboard.status === DASHBOARD_STATUS.ARCHIVED) notFound();
    role = membership.role;
  }

  // A platform VIEWER is read-only everywhere, whatever their membership says. The
  // stricter of the two answers wins, so a generous grant cannot widen a read-only
  // account.
  const writes = sessionCanEdit(session) && membershipCanEdit(role);
  const canManage = admin || role === MEMBERSHIP_ROLES.MANAGER;

  return {
    session,
    dashboard,
    role,
    canManage,
    canTick: writes,
    canContribute: writes,
    canSeeCredentials: membershipCanSeeCredentials(role),
    canUseOfferLogins: canManage || writes,
  };
}

/**
 * The default guard for a write.
 *
 * Requires managing the dashboard, not merely being on it. Every action starts here and
 * only the two a member is trusted with — ticking a task, adding an SOP — reach for a
 * looser guard, so forgetting to think about permissions fails closed.
 */
export async function requireDashboardEditor(
  slug: string,
): Promise<DashboardContext> {
  const context = await resolveDashboard(slug);
  if (!context.canManage) throw new Error("Not allowed.");
  return context;
}

/** Ticking a task off — the one write an ordinary member has. */
export async function requireDashboardTick(
  slug: string,
): Promise<DashboardContext> {
  const context = await resolveDashboard(slug);
  if (!context.canTick) throw new Error("Read-only account.");
  return context;
}

/** Adding to the SOP library. Deletions are rejected separately, on save. */
export async function requireDashboardContribute(
  slug: string,
): Promise<DashboardContext> {
  const context = await resolveDashboard(slug);
  if (!context.canContribute) throw new Error("Read-only account.");
  return context;
}

/** Managing people, settings and the SOP library's shape. */
export async function requireDashboardManager(
  slug: string,
): Promise<DashboardContext> {
  const context = await resolveDashboard(slug);
  if (!context.canManage) notFound();
  return context;
}

/**
 * Opening a stored password.
 *
 * Members are allowed through because they reach logins on an offer's own page — the
 * page decides what to show, this decides what may be opened, and a member who can see
 * a card must be able to use it or the card is furniture.
 */
export async function requireVaultAccess(
  slug: string,
): Promise<DashboardContext> {
  const context = await resolveDashboard(slug);
  if (!context.canUseOfferLogins) {
    throw new Error("Logins are limited to people on this dashboard.");
  }
  return context;
}

/** Writing to a login. Reading one is looser; changing it is not. */
export async function requireVaultWrite(
  slug: string,
): Promise<DashboardContext> {
  const context = await resolveDashboard(slug);
  if (!context.canManage) {
    throw new Error("Logins can only be changed by managers.");
  }
  return context;
}

/**
 * The dashboard a server action is writing to, verified against the session rather than
 * trusted from the form body.
 *
 * Actions post a slug in a hidden field. That field is user input like any other, so it
 * buys nothing on its own — it is only ever a lookup key, and the membership check
 * behind it is what decides the answer.
 */
export async function requireDashboardWrite(
  slug: string,
): Promise<DashboardContext> {
  return requireDashboardEditor(slug);
}

/**
 * A client inside a dashboard, resolved together so no caller can pair a client id from
 * one dashboard with a slug from another.
 */
export async function resolveClient(dashboardSlug: string, clientSlug: string) {
  const context = await resolveDashboard(dashboardSlug);
  const client = await prisma.client.findUnique({
    where: {
      dashboardId_slug: {
        dashboardId: context.dashboard.id,
        slug: clientSlug,
      },
    },
  });
  if (!client) notFound();
  return { ...context, client };
}

/** Every dashboard this person may open, in the order the hub shows them. */
export async function accessibleDashboards(session: Session) {
  const where = isAdmin(session)
    ? {}
    : {
        status: { not: DASHBOARD_STATUS.ARCHIVED },
        memberships: { some: { userId: session.userId } },
      };

  return prisma.dashboard.findMany({
    where,
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    select: DASHBOARD_FIELDS,
  });
}

/**
 * Where someone should land after signing in.
 *
 * An admin gets the hub. Everyone else goes straight into their dashboard when they
 * have exactly one — the common case, and a directory listing a single card is a click
 * that teaches nothing.
 */
export async function homePathFor(session: Session): Promise<string> {
  if (isAdmin(session)) return "/hub";
  const dashboards = await accessibleDashboards(session);
  if (dashboards.length === 0) return "/no-access";
  if (dashboards.length === 1) return `/d/${dashboards[0].slug}`;
  return "/switch";
}
