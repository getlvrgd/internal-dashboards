/**
 * The board's task shape, and the selectors that slice it into panels.
 *
 * Pure and free of any boundary directive, because both sides need it: the server page
 * builds the list and computes the daily count for the progress bar, and the client
 * store re-derives the same slices from optimistic state. Keeping these in the
 * "use client" store made them unreachable from the server — which typechecks and lints
 * perfectly and fails the moment the page renders.
 */

export type BoardTask = {
  id: string;
  title: string;
  status: string;
  priority: string;
  recurring: boolean;
  clientId: string | null;
  assigneeId: string | null;
  /** 0 = Monday … 6 = Sunday. Null means it is not scheduled to a day. */
  day: number | null;
  /** ISO date of the Monday this belongs to, or null for unscheduled. */
  weekOf: string | null;
  position: number;
};

const byPosition = (a: BoardTask, b: BoardTask) => a.position - b.position;

/** The tasks scheduled to one day of the week on screen. */
export const tasksForDay = (tasks: BoardTask[], day: number) =>
  tasks.filter((t) => t.day === day && t.weekOf !== null).sort(byPosition);

/**
 * The daily list: what is on today, plus anything never given a day.
 *
 * These are not copies. A task scheduled for today appears here *and* in its day on the
 * week, because it is one row rendered twice — which is what makes ticking it in one
 * place tick it in the other without any syncing logic at all.
 *
 * Unscheduled tasks are included rather than hidden: they are things to do, they have
 * no other home now that the panel is "today", and dropping them from the only list
 * that shows them would look like they had been deleted.
 *
 * `today` is null when the week on screen is not the current one, in which case only
 * the unscheduled ones remain — a past Tuesday is history, not a to-do list.
 */
export const tasksForToday = (tasks: BoardTask[], today: number | null) =>
  tasks
    .filter((t) => t.weekOf === null || (today !== null && t.day === today))
    .sort(byPosition);
