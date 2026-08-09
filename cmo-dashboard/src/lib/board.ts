/**
 * What the board is made of.
 *
 * The board used to be a fixed page: KPIs, then progress, then the days, then the to-do
 * list, in that order, with those words. It is now five panels you drag into the order
 * you want and retitle — because "weekly actionable tasks" is what one person calls the
 * week and "the grind" is what another calls it, and neither should have to ask for a
 * code change.
 *
 * Only order and headings live here. What a panel *contains* is still ordinary data in
 * ordinary tables — this is a layout, not a document, and the moment it starts holding
 * content it becomes a second place to look for a task.
 *
 * Pure, so it is safe on both sides of the client boundary.
 */

/** The panels that exist. Adding one here is what makes it available to a board. */
export const PANEL_KINDS = [
  "progress",
  "revenue",
  "kpis",
  "todo",
  "week",
  "calls",
] as const;

export type PanelKind = (typeof PANEL_KINDS)[number];

export const isPanelKind = (value: unknown): value is PanelKind =>
  typeof value === "string" && (PANEL_KINDS as readonly string[]).includes(value);

export type Panel = {
  kind: PanelKind;
  /** The heading shown above it. Blank renders the panel with no heading at all. */
  title: string;
  /** Hidden panels stay in the layout so unhiding restores their position. */
  hidden: boolean;
};

export type BoardLayout = { panels: Panel[] };

/**
 * The order a board starts in, and what each panel is called.
 *
 * The daily list sits above the week deliberately: it is what has to happen today, and
 * burying it under seven day-cards is how it stops being looked at.
 */
export const DEFAULT_PANELS: Panel[] = [
  { kind: "progress", title: "Progress", hidden: false },
  { kind: "revenue", title: "Revenue", hidden: false },
  { kind: "kpis", title: "Numbers", hidden: false },
  { kind: "todo", title: "Today", hidden: false },
  { kind: "week", title: "Weekly actionable tasks", hidden: false },
  { kind: "calls", title: "Calls", hidden: false },
];

export const defaultLayout = (): BoardLayout => ({
  panels: DEFAULT_PANELS.map((p) => ({ ...p })),
});

/**
 * Reads a stored layout back.
 *
 * Everything is coerced rather than trusted — the column is JSON, so a hand-edited row
 * must not be able to take the board down. Two rules matter beyond that:
 *
 *   * A panel kind this version does not know about is dropped, so removing a feature
 *     does not strand a board that still lists it.
 *   * A panel kind that exists but is absent from the stored layout is appended, so
 *     ADDING a panel shows up on boards saved before it existed. Without this, every
 *     new panel would be invisible to everyone who had ever reordered anything.
 */
export function parseBoardLayout(raw: unknown): BoardLayout {
  const stored = (raw as { panels?: unknown } | null)?.panels;
  const panels: Panel[] = [];
  const seen = new Set<PanelKind>();

  if (Array.isArray(stored)) {
    for (const entry of stored) {
      if (!entry || typeof entry !== "object") continue;
      const o = entry as Record<string, unknown>;
      if (!isPanelKind(o.kind) || seen.has(o.kind)) continue;
      seen.add(o.kind);
      panels.push({
        kind: o.kind,
        title:
          typeof o.title === "string"
            ? o.title.slice(0, 60)
            : defaultTitle(o.kind),
        hidden: o.hidden === true,
      });
    }
  }

  for (const fallback of DEFAULT_PANELS) {
    if (!seen.has(fallback.kind)) panels.push({ ...fallback });
  }

  return { panels };
}

export const defaultTitle = (kind: PanelKind) =>
  DEFAULT_PANELS.find((p) => p.kind === kind)?.title ?? kind;

/* -------------------------------------------------------------------- copy -- */

/**
 * The line beside the progress bar.
 *
 * Deliberately not a neutral "0 of 13 complete". A board is read every morning, and a
 * number with nothing said about it stops registering after a week — this is the one
 * place the app is allowed a voice.
 */
export function progressNote(done: number, total: number): string {
  if (total === 0) return "nothing on the board yet.";
  if (done === 0) return "nothing done yet. the needle's waiting.";
  const pct = Math.round((done / total) * 100);
  if (pct === 100) return "all of it. done.";
  if (pct >= 80) return "nearly there — finish it.";
  if (pct >= 50) return "past halfway.";
  if (pct >= 25) return "moving.";
  return "started.";
}
