/**
 * The fixed vocabularies of the app: roles, statuses, priorities, days, tints.
 *
 * Plain strings validated here rather than database enums, so a list can be edited
 * without a migration.
 */

export type Option = { value: string; label: string };

/* ---------------------------------------------------------------------- roles -- */

export const ROLES = {
  /**
   * One owner, created by first-run setup and by nothing else — deliberately absent
   * from ASSIGNABLE_ROLES, so no admin can hand the role out or take it.
   */
  OWNER: "OWNER",
  ADMIN: "ADMIN",
  CMO: "CMO",
  VIEWER: "VIEWER",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ASSIGNABLE_ROLES: Option[] = [
  { value: ROLES.CMO, label: "CMO — runs the board, no credentials" },
  { value: ROLES.VIEWER, label: "Viewer — read-only" },
  { value: ROLES.ADMIN, label: "Admin — everything, including logins" },
];

const ADMIN_ROLES: string[] = [ROLES.OWNER, ROLES.ADMIN];

/** Ask this rather than comparing against ROLES.ADMIN by hand — it misses the owner. */
export const hasAdminAccess = (role: string) => ADMIN_ROLES.includes(role);

/**
 * Who may edit the board. A viewer reads; everyone else writes.
 *
 * This is deliberately separate from hasAdminAccess: the CMO runs the week and should
 * not have to ask anyone to add a task, but the login vault is a different question and
 * asks the stricter one.
 */
export const canEdit = (role: string) => role !== ROLES.VIEWER;

/** The login vault. Credentials are the one thing a CMO account cannot reach. */
export const canSeeCredentials = (role: string) => hasAdminAccess(role);

export const roleLabel = (value: string) =>
  ({ OWNER: "Owner", ADMIN: "Admin", CMO: "CMO", VIEWER: "Viewer" })[value] ??
  value;

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

export function slugify(input: string) {
  return (
    input
      .toLowerCase()
      .trim()
      .replace(/['’]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "client"
  );
}
