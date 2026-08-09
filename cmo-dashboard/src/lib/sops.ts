/**
 * The SOP library's shape.
 *
 * This is the sales rep hub's content model, brought across so the two products are
 * edited the same way — flattened by one level, because an area holding pages holding
 * blocks was a layer of grouping nobody used:
 *
 *     content → pages[] → blocks[]
 *
 * The board this replaces was a flat list of title + URL under a category, which meant
 * an SOP could only ever *point* somewhere. Most of them are not a link — they are a
 * walkthrough with a video, the written steps beside it, and a checklist you work
 * through. Those are blocks, so they live here rather than in whatever document the
 * link happened to open.
 *
 * Nothing in this file touches the database or the session, so it is safe on both
 * sides of the client boundary; src/lib/db.ts stores the whole thing as one JSON
 * column on Dashboard.sopContent.
 */

/** An extra link hanging off a block — the doc that goes with a video, say. */
export type SopLink = { label: string; url: string };

/**
 * The badge on a block. Free text would drift into six spellings of "document", so the
 * set is fixed and anything unrecognised renders as LINK.
 */
export const BADGES = [
  "DOC",
  "LOOM",
  "VIDEO",
  "FORM",
  "SHEET",
  "DECK",
  "TOOL",
  "PAGE",
  "LINK",
] as const;

export type Badge = (typeof BADGES)[number];

export const isBadge = (value: unknown): value is Badge =>
  typeof value === "string" && (BADGES as readonly string[]).includes(value);

/**
 * One block on a page.
 *
 * `type` decides both how it renders and which fields the editor offers:
 *
 *   link   the default — a badge, a title, a link and one line of description
 *   video  an embedded player, with body text and extra links underneath
 *   text   a written note: heading and body, no link of its own
 *   tasks  a checklist the owner writes and everyone else ticks off
 *   call   a standing call: when it happens, and a link that joins it
 */
export type SopBlock = {
  id: string;
  type: "link" | "video" | "text" | "tasks" | "call";
  /** Title */
  title: string;
  /** Badge — DOC / LOOM / FORM / … */
  badge?: Badge;
  /** Link. Empty string renders as "Link not set". */
  url?: string;
  /** One-line description */
  description?: string;
  /** Video to play in the page. Loom, YouTube, Vimeo or Google Drive. */
  embed?: string;
  /** Longer written text, shown under a video or as the body of a text block. */
  body?: string;
  /** When a call happens. Free text, so "Every weekday at 9:00am" is as valid as a date. */
  time?: string;
  /** Extra links shown beneath — the SOP doc alongside a walkthrough, for instance. */
  links?: SopLink[];
  /**
   * The steps of a checklist block, in order.
   *
   * The wording is content and only an editor changes it. Whether someone has ticked a
   * step is not stored here — it lives in that person's own browser, so one person
   * working through a list never changes what anyone else sees.
   */
  tasks?: string[];
  /** Start folded shut. Long reference lists stay out of the way until wanted. */
  collapsed?: boolean;
  /** Highlight tint — one of the eight tile colours. Absent means no highlight. */
  color?: string;
};

export type SopPage = {
  id: string;
  title: string;
  /** One line under the page title. */
  summary?: string;
  blocks: SopBlock[];
};

export type SopContent = {
  pages: SopPage[];
};

/* ------------------------------------------------------------------ counting -- */

/**
 * The address a block is meant to point at, or null when it has none.
 *
 * This is what "links filled" counts, so it has to know that a written note or a
 * checklist has nothing to fill in — otherwise every one of them reads as a link
 * someone forgot, and the number stops meaning anything.
 */
export function linkTarget(block: SopBlock): string | null {
  switch (block.type) {
    case "text":
    case "tasks":
      return null;
    case "call":
      // A call with no join link is a link left blank, so it counts.
      return block.url ?? "";
    case "video":
      // The player is the point; `url` is only a fallback.
      return block.embed || block.url || "";
    default:
      return block.url ?? "";
  }
}

/** How much of a library actually has links in it. Drives the owner hub's fill figure. */
export function countLinks(content: SopContent | null | undefined) {
  let total = 0;
  let done = 0;

  for (const page of content?.pages ?? []) {
    for (const block of page.blocks ?? []) {
      const url = linkTarget(block);
      if (url === null) continue;
      total += 1;
      if (url) done += 1;
    }
  }

  return { total, done, pct: total ? Math.round((done / total) * 100) : 0 };
}

/** Every block in a library, flattened — used for counts and search. */
export function allBlocks(content: SopContent | null | undefined): SopBlock[] {
  return (content?.pages ?? []).flatMap((p) => p.blocks ?? []);
}

/* ------------------------------------------------------------------- parsing -- */

const str = (value: unknown): string =>
  typeof value === "string" ? value : "";

const optional = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value : undefined;

/** Cheap unique id. Blocks are only ever addressed within one document. */
export const newId = () =>
  `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

function parseBlock(raw: unknown): SopBlock | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  const type = r.type;
  const kind: SopBlock["type"] =
    type === "video" || type === "text" || type === "tasks" || type === "call"
      ? type
      : "link";

  return {
    id: str(r.id) || newId(),
    type: kind,
    title: str(r.title),
    badge: isBadge(r.badge) ? r.badge : undefined,
    url: optional(r.url),
    description: optional(r.description),
    embed: optional(r.embed),
    body: optional(r.body),
    time: optional(r.time),
    links: Array.isArray(r.links)
      ? r.links
          .map((l) => {
            const o = (l ?? {}) as Record<string, unknown>;
            return { label: str(o.label), url: str(o.url) };
          })
          .filter((l) => l.label || l.url)
      : undefined,
    tasks: Array.isArray(r.tasks)
      ? r.tasks.map(str).filter(Boolean)
      : undefined,
    collapsed: r.collapsed === true ? true : undefined,
    color: optional(r.color),
  };
}

/**
 * Reads a stored document back.
 *
 * Everything is coerced rather than trusted: the column is JSON, so a hand-edited row
 * or a document written by an older version of this file must not be able to crash a
 * page. Anything unrecognised is dropped, and a missing document reads as empty.
 */
function parsePage(raw: unknown): SopPage | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const blocks = Array.isArray(o.blocks) ? o.blocks : [];
  return {
    id: str(o.id) || newId(),
    title: str(o.title) || "Untitled",
    summary: optional(o.summary),
    blocks: blocks.map(parseBlock).filter((b): b is SopBlock => b !== null),
  };
}

/**
 * Reads a stored document back.
 *
 * Everything is coerced rather than trusted: the column is JSON, so a hand-edited row
 * or a document written by an older version of this file must not be able to crash a
 * page. Anything unrecognised is dropped, and a missing document reads as empty.
 *
 * Documents saved before areas were removed are flattened here rather than by a data
 * migration — the shape is JSON, so the reader is the only place that has to know about
 * the old layout, and nothing has to be rewritten in place. A one-page area becomes a
 * page under the AREA's name, since that was the meaningful word ("YouTube", not
 * "Publishing"); an area with several pages keeps its pages, which were already
 * distinct.
 */
export function parseSopContent(raw: unknown): SopContent {
  if (!raw || typeof raw !== "object") return { pages: [] };
  const root = raw as Record<string, unknown>;

  if (Array.isArray(root.pages)) {
    return {
      pages: root.pages
        .map(parsePage)
        .filter((p): p is SopPage => p !== null),
    };
  }

  if (Array.isArray(root.sections)) {
    const pages: SopPage[] = [];
    for (const section of root.sections) {
      if (!section || typeof section !== "object") continue;
      const o = section as Record<string, unknown>;
      const sectionTitle = str(o.title) || "Untitled";
      const parsed = (Array.isArray(o.pages) ? o.pages : [])
        .map(parsePage)
        .filter((p): p is SopPage => p !== null);

      if (parsed.length === 0) {
        pages.push({ id: newId(), title: sectionTitle, blocks: [] });
      } else if (parsed.length === 1) {
        pages.push({ ...parsed[0], title: sectionTitle });
      } else {
        pages.push(...parsed);
      }
    }
    return { pages };
  }

  return { pages: [] };
}

/* ------------------------------------------------------------------ template -- */

/**
 * What a new dashboard's SOP library starts from.
 *
 * One page per area the Notion board this replaces used, in the same order, with the
 * links left blank. Editing this changes what NEW dashboards are
 * created with; existing ones keep their own copy in the database, so nothing here
 * rewrites work already done.
 */
const STARTER_PAGES = [
  "Ads",
  "YouTube",
  "Instagram",
  "VSL Funnel",
  "Calls",
  "Webinar",
  "Waitlist",
  "Messaging",
];

export function starterSopContent(): SopContent {
  return {
    pages: STARTER_PAGES.map((title) => ({
      id: newId(),
      title,
      blocks: [
        {
          id: newId(),
          type: "link" as const,
          title: "SOP document",
          badge: "DOC" as Badge,
          url: "",
          description: "The written procedure.",
        },
      ],
    })),
  };
}
