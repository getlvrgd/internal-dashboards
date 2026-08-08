/**
 * The fixed vocabularies of the app: roles, statuses, priorities, days, tints.
 *
 * Plain strings validated here rather than database enums, so a list can be edited
 * without a migration.
 */

export type Option = { value: string; label: string };

/* ---------------------------------------------------------------------- roles -- */

/**
 * The platform role on the account itself.
 *
 * This answers "may this person reach the owner hub, and every dashboard in it?" —
 * nothing finer. What someone may do *inside* one dashboard is a Membership, below,
 * because the same person can run one dashboard and only read another.
 */
export const ROLES = {
  /**
   * One owner, created by first-run setup and by nothing else — deliberately absent
   * from ASSIGNABLE_ROLES, so no admin can hand the role out or take it.
   */
  OWNER: "OWNER",
  /** Reaches every dashboard and the owner hub, but cannot delete a dashboard. */
  ADMIN: "ADMIN",
  /** Reaches exactly the dashboards they hold a Membership for. */
  MEMBER: "MEMBER",
  /** As MEMBER, but never writes anywhere. */
  VIEWER: "VIEWER",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ASSIGNABLE_ROLES: Option[] = [
  { value: ROLES.MEMBER, label: "Member — only the dashboards you grant" },
  { value: ROLES.VIEWER, label: "Viewer — read-only, everywhere" },
  { value: ROLES.ADMIN, label: "Admin — every dashboard, including logins" },
];

const ADMIN_ROLES: string[] = [ROLES.OWNER, ROLES.ADMIN];

/** Ask this rather than comparing against ROLES.ADMIN by hand — it misses the owner. */
export const hasAdminAccess = (role: string) => ADMIN_ROLES.includes(role);

export const isOwnerRole = (role: string) => role === ROLES.OWNER;

/**
 * Who may write at all. A viewer reads; everyone else's write is then checked again
 * against their membership on the dashboard they are writing to.
 */
export const canEdit = (role: string) => role !== ROLES.VIEWER;

export const roleLabel = (value: string) =>
  ({
    OWNER: "Owner",
    ADMIN: "Admin",
    MEMBER: "Member",
    VIEWER: "Viewer",
  })[value] ?? value;

/* -------------------------------------------------------- membership roles -- */

/**
 * What someone may do inside one dashboard they have been given.
 *
 * MANAGER is the per-dashboard equivalent of an admin: they run that dashboard and can
 * open its logins, but the grant stops at its edge. That is the whole point of keeping
 * this separate from the platform role — handing someone the CMO dashboard should not
 * hand them the next dashboard you build.
 */
export const MEMBERSHIP_ROLES = {
  MANAGER: "MANAGER",
  MEMBER: "MEMBER",
  VIEWER: "VIEWER",
} as const;

export type MembershipRole =
  (typeof MEMBERSHIP_ROLES)[keyof typeof MEMBERSHIP_ROLES];

export const MEMBERSHIP_ROLE_OPTIONS: Option[] = [
  { value: MEMBERSHIP_ROLES.MANAGER, label: "Manager — runs it, sees logins" },
  { value: MEMBERSHIP_ROLES.MEMBER, label: "Member — edits the board" },
  { value: MEMBERSHIP_ROLES.VIEWER, label: "Viewer — read-only" },
];

export const ALL_MEMBERSHIP_ROLES: string[] = Object.values(MEMBERSHIP_ROLES);

export const membershipRoleLabel = (value: string) =>
  ({ MANAGER: "Manager", MEMBER: "Member", VIEWER: "Viewer" })[value] ?? value;

/**
 * The login vault, asked per dashboard.
 *
 * Credentials are the one thing an ordinary member cannot reach: a login is the client's
 * account, not ours, and "everyone on the board" is too wide a door for it.
 */
export const membershipCanSeeCredentials = (role: string) =>
  role === MEMBERSHIP_ROLES.MANAGER;

export const membershipCanEdit = (role: string) =>
  role !== MEMBERSHIP_ROLES.VIEWER;

/* ------------------------------------------------------ dashboard statuses -- */

export const DASHBOARD_STATUS = {
  LIVE: "LIVE",
  DRAFT: "DRAFT",
  ARCHIVED: "ARCHIVED",
} as const;

export const DASHBOARD_STATUSES: Option[] = [
  { value: DASHBOARD_STATUS.LIVE, label: "Live" },
  { value: DASHBOARD_STATUS.DRAFT, label: "Draft" },
  { value: DASHBOARD_STATUS.ARCHIVED, label: "Archived" },
];

export const ALL_DASHBOARD_STATUSES: string[] =
  Object.values(DASHBOARD_STATUS);

export const dashboardStatusLabel = (value: string) =>
  DASHBOARD_STATUSES.find((s) => s.value === value)?.label ?? value;

/* ------------------------------------------------------------- task statuses -- */

export const TASK_STATUS = {
  NOT_STARTED: "NOT_STARTED",
  IN_PROGRESS: "IN_PROGRESS",
  DONE: "DONE",
  BLOCKED: "BLOCKED",
} as const;

export type TaskStatus = (typeof TASK_STATUS)[keyof typeof TASK_STATUS];

export const TASK_STATUSES: Option[] = [
  { value: TASK_STATUS.NOT_STARTED, label: "Not started" },
  { value: TASK_STATUS.IN_PROGRESS, label: "In progress" },
  { value: TASK_STATUS.DONE, label: "Done" },
  { value: TASK_STATUS.BLOCKED, label: "Blocked" },
];

export const ALL_TASK_STATUSES: string[] = Object.values(TASK_STATUS);

export const taskStatusLabel = (value: string) =>
  TASK_STATUSES.find((s) => s.value === value)?.label ?? value;

/**
 * The dot beside a status. Blocked is the only one that wears the critical colour —
 * "not started" on a Monday is normal, and colouring it red would cry wolf all week.
 */
export const taskStatusTint = (value: string) =>
  ({
    NOT_STARTED: "var(--text-muted)",
    IN_PROGRESS: "var(--series-1)",
    DONE: "var(--status-good)",
    BLOCKED: "var(--status-critical)",
  })[value] ?? "var(--text-muted)";

/* ----------------------------------------------------------------- priority -- */

export const PRIORITIES: Option[] = [
  { value: "LOW", label: "Low" },
  { value: "NORMAL", label: "Normal" },
  { value: "HIGH", label: "High" },
];

export const ALL_PRIORITIES: string[] = PRIORITIES.map((p) => p.value);

/* ----------------------------------------------------------- client status -- */

export const CLIENT_STATUS = {
  LIVE: "LIVE",
  ONBOARDING: "ONBOARDING",
  PAUSED: "PAUSED",
  CHURNED: "CHURNED",
} as const;

export const CLIENT_STATUSES: Option[] = [
  { value: CLIENT_STATUS.LIVE, label: "Live" },
  { value: CLIENT_STATUS.ONBOARDING, label: "Onboarding" },
  { value: CLIENT_STATUS.PAUSED, label: "Paused" },
  { value: CLIENT_STATUS.CHURNED, label: "Churned" },
];

export const ALL_CLIENT_STATUSES: string[] = Object.values(CLIENT_STATUS);

export const clientStatusLabel = (value: string) =>
  CLIENT_STATUSES.find((s) => s.value === value)?.label ?? value;

/* --------------------------------------------------------------------- days -- */

/**
 * Monday-first, matching the board. The index is what `Task.day` stores, so this array's
 * order is load-bearing — it is not just a display list.
 */
export const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

export const dayLabel = (day: number | null) =>
  day === null || day < 0 || day > 6 ? "Unscheduled" : DAYS[day];

/** The per-day chip colour on the board, echoing the Notion original's day pills. */
export const dayTint = (day: number) =>
  [
    "violet",
    "aqua",
    "yellow",
    "red",
    "blue",
    "orange",
    "magenta",
  ][day] ?? "blue";

/* -------------------------------------------------------------------- tints -- */

/**
 * The eight pastels a client or KPI tile can wear — the same set the sales hub uses,
 * so the two products look like one system.
 */
export const TILE_COLORS: Option[] = [
  { value: "blue", label: "Blue" },
  { value: "aqua", label: "Aqua" },
  { value: "green", label: "Green" },
  { value: "yellow", label: "Yellow" },
  { value: "orange", label: "Orange" },
  { value: "red", label: "Red" },
  { value: "magenta", label: "Pink" },
  { value: "violet", label: "Violet" },
];

const TILE_COLOR_VALUES = new Set(TILE_COLORS.map((c) => c.value));

/**
 * Guards the interpolation into `var(--tile-…)`.
 *
 * The value reaches here from stored rows, so it is user input landing in a style
 * attribute. Anything not on the list is treated as no colour at all.
 */
export const isTileColor = (value: unknown): value is string =>
  typeof value === "string" && TILE_COLOR_VALUES.has(value);

/* --------------------------------------------------------------------- slug -- */

export function slugify(input: string, fallback = "item") {
  return (
    input
      .toLowerCase()
      .trim()
      .replace(/['’]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || fallback
  );
}

/**
 * Slugs are unique per scope, and a person naming their second "Acme" should get
 * `acme-2` rather than an error telling them to think of a different name.
 */
export function uniqueSlug(base: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  if (!used.has(base)) return base;
  for (let n = 2; n < 500; n += 1) {
    const candidate = `${base}-${n}`;
    if (!used.has(candidate)) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}
