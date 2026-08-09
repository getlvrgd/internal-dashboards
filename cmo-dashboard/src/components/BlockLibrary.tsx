"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { safeHref } from "@/lib/links";
import {
  BADGES,
  newId,
  type Badge,
  type SopBlock,
  type SopContent,
  type SopPage,
} from "@/lib/sops";

import { EmptyNote, ghostButtonClass, inputClass, primaryButtonClass } from "./ui";

/**
 * A block library: reader and editor in one component.
 *
 * Used for both the dashboard's SOP library and a client's asset directory — the same
 * document shape, so the same editor. What differs is only where it is saved, which is
 * why `save` is a prop rather than an import.
 *
 * One component rather than two because they are the same tree with different leaves,
 * and keeping a separate read-only renderer in step with the editor is how the two
 * quietly drift apart until a block type renders in one and not the other.
 *
 * The whole document is held in state and posted on Save. That is deliberate: a library
 * is edited in bursts — retitle a section, add three blocks, fix a link — and a write
 * per keystroke would be a great deal of machinery for something one person touches a
 * few times a month.
 */
export function BlockLibrary({
  content: initial,
  save: saveContent,
  canEdit,
  canDelete = true,
  emptyNote = "Nothing here yet.",
}: {
  content: SopContent;
  /** A bound server action. Takes the whole document as JSON. */
  save: (json: string) => Promise<{ ok?: true; error?: string }>;
  canEdit: boolean;
  /**
   * Whether removing a page or a block is offered. A contributor may add procedures but
   * never lose one — the server enforces the same rule on save, so hiding the buttons
   * is only there to stop someone building an edit that will be refused.
   */
  canDelete?: boolean;
  emptyNote?: string;
}) {
  const [content, setContent] = useState<SopContent>(initial);
  const [editing, setEditing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const update = (next: SopContent) => {
    setContent(next);
    setDirty(true);
  };

  const mapPages = (fn: (pages: SopPage[]) => SopPage[]) =>
    update({ ...content, pages: fn(content.pages) });

  const save = () => {
    setError(null);
    startTransition(async () => {
      const result = await saveContent(JSON.stringify(content));
      if (result?.error) {
        setError(result.error);
        return;
      }
      setDirty(false);
      setEditing(false);
      router.refresh();
    });
  };

  const cancel = () => {
    setContent(initial);
    setDirty(false);
    setEditing(false);
    setError(null);
  };

  return (
    <div>
      {canEdit && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {editing ? (
            <>
              <button
                onClick={save}
                disabled={pending || !dirty}
                className={primaryButtonClass}
              >
                {pending ? "Saving…" : dirty ? "Save changes" : "Saved"}
              </button>
              <button onClick={cancel} className={ghostButtonClass}>
                Cancel
              </button>
              <button
                onClick={() =>
                  mapPages((p) => [
                    ...p,
                    { id: newId(), title: "New page", blocks: [] },
                  ])
                }
                className={ghostButtonClass}
              >
                + Page
              </button>
              {dirty && (
                <span className="text-[12px] text-ink-muted">
                  Unsaved changes
                </span>
              )}
            </>
          ) : (
            <button onClick={() => setEditing(true)} className={ghostButtonClass}>
              Edit
            </button>
          )}
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="mb-4 text-[12.5px]"
          style={{ color: "var(--status-critical)" }}
        >
          {error}
        </p>
      )}

      {/* Section jump list. Links rather than tabs, so nothing is hidden — the point is
          being able to see that an area has gone thin. */}
      {content.pages.length > 1 && !editing && (
        <nav className="scroll-x mb-6 flex gap-1.5 pb-1">
          {content.pages.map((page) => (
            <a
              key={page.id}
              href={`#${page.id}`}
              className="shrink-0 rounded-full border border-subtle px-2.5 py-1 text-[12px] font-semibold text-ink-secondary transition-colors hover:border-strong hover:text-ink"
            >
              {page.title}
              <span className="ml-1 text-ink-muted tabular">
                {page.blocks.length}
              </span>
            </a>
          ))}
        </nav>
      )}

      {content.pages.length === 0 ? (
        <EmptyNote>
          {emptyNote}
          {canEdit && " Use “Edit” to add the first page."}
        </EmptyNote>
      ) : (
        <div className="space-y-8">
          {content.pages.map((page, pageIndex) => (
            <PageView
              key={page.id}
              page={page}
              editing={editing}
              canDelete={canDelete}
              onChange={(next) =>
                mapPages((p) => p.map((x, i) => (i === pageIndex ? next : x)))
              }
              onRemove={() =>
                mapPages((p) => p.filter((_, i) => i !== pageIndex))
              }
              onMove={(delta) => mapPages((p) => move(p, pageIndex, delta))}
              first={pageIndex === 0}
              last={pageIndex === content.pages.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** Swaps an item with its neighbour, or returns the list untouched at either end. */
function move<T>(list: T[], index: number, delta: number): T[] {
  const target = index + delta;
  if (target < 0 || target >= list.length) return list;
  const next = [...list];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

function PageView({
  page,
  editing,
  canDelete,
  onChange,
  onRemove,
  onMove,
  first,
  last,
}: {
  page: SopPage;
  editing: boolean;
  canDelete: boolean;
  onChange: (next: SopPage) => void;
  onRemove: () => void;
  onMove: (delta: number) => void;
  first: boolean;
  last: boolean;
}) {
  const setBlocks = (blocks: SopBlock[]) => onChange({ ...page, blocks });

  const addBlock = (type: SopBlock["type"]) =>
    setBlocks([
      ...page.blocks,
      {
        id: newId(),
        type,
        title:
          type === "tasks"
            ? "Checklist"
            : type === "text"
              ? "Notes"
              : type === "video"
                ? "Walkthrough"
                : type === "call"
                  ? "Standing call"
                  : "New entry",
        ...(type === "tasks" ? { tasks: ["First step"] } : {}),
      },
    ]);

  return (
    <article id={page.id} className="scroll-mt-20">
      <header className="mb-3 flex flex-wrap items-start gap-2 border-b border-subtle pb-2">
        <div className="min-w-0 flex-1">
          {editing ? (
            <div className="space-y-1.5">
              <input
                value={page.title}
                onChange={(e) => onChange({ ...page, title: e.target.value })}
                className={`${inputClass} w-full font-semibold`}
                aria-label="Page title"
              />
              <input
                value={page.summary ?? ""}
                onChange={(e) =>
                  onChange({ ...page, summary: e.target.value || undefined })
                }
                placeholder="One line about this page"
                className={`${inputClass} w-full`}
                aria-label="Page summary"
              />
            </div>
          ) : (
            <>
              <h3 className="text-[17px] font-bold tracking-tight">
                {page.title}
              </h3>
              {page.summary && (
                <p className="mt-0.5 text-[12.5px] text-ink-muted">
                  {page.summary}
                </p>
              )}
            </>
          )}
        </div>

        {editing && (
          <span className="flex shrink-0 items-center gap-1">
            <IconButton label="Move up" onClick={() => onMove(-1)} disabled={first}>
              ↑
            </IconButton>
            <IconButton label="Move down" onClick={() => onMove(1)} disabled={last}>
              ↓
            </IconButton>
            {canDelete && (
              <button
                onClick={() => {
                  if (
                    window.confirm(
                      `Delete “${page.title}” and everything on it?`,
                    )
                  ) {
                    onRemove();
                  }
                }}
                className="text-[12px] font-semibold text-critical underline-offset-2 hover:underline"
              >
                Delete
              </button>
            )}
          </span>
        )}
      </header>

      {page.blocks.length === 0 && !editing && (
        <EmptyNote>Nothing here yet.</EmptyNote>
      )}

      {/* Tiles when reading, a list when editing. A grid is the fastest thing to scan
          for "where is the deck"; a list is the only sane thing to reorder in. */}
      <div
        className={
          editing
            ? "space-y-2.5"
            : "grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3"
        }
      >
        {page.blocks.map((block, blockIndex) => (
          <BlockView
            key={block.id}
            block={block}
            editing={editing}
            canDelete={canDelete}
            onChange={(next) =>
              setBlocks(page.blocks.map((b, i) => (i === blockIndex ? next : b)))
            }
            onRemove={() =>
              setBlocks(page.blocks.filter((_, i) => i !== blockIndex))
            }
            onMove={(delta) => setBlocks(move(page.blocks, blockIndex, delta))}
            first={blockIndex === 0}
            last={blockIndex === page.blocks.length - 1}
          />
        ))}
      </div>

      {editing && (
        <div className="mt-3 flex flex-wrap gap-1.5 border-t border-subtle pt-3">
          {(["link", "video", "call", "text", "tasks"] as const).map((type) => (
            <button
              key={type}
              onClick={() => addBlock(type)}
              className={ghostButtonClass}
            >
              + {type === "tasks" ? "Checklist" : type}
            </button>
          ))}
        </div>
      )}
    </article>
  );
}

function BlockView({
  block,
  editing,
  canDelete,
  onChange,
  onRemove,
  onMove,
  first,
  last,
}: {
  block: SopBlock;
  editing: boolean;
  canDelete: boolean;
  onChange: (next: SopBlock) => void;
  onRemove: () => void;
  onMove: (delta: number) => void;
  first: boolean;
  last: boolean;
}) {
  if (editing) {
    return (
      <div className="rounded-lg border border-subtle p-3">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="rounded border border-subtle px-1.5 py-0.5 text-[10px] font-bold tracking-widest text-ink-muted uppercase">
            {block.type}
          </span>
          <input
            value={block.title}
            onChange={(e) => onChange({ ...block, title: e.target.value })}
            placeholder="Title"
            className={`${inputClass} min-w-0 flex-1`}
            aria-label="Entry title"
          />
          <IconButton label="Move up" onClick={() => onMove(-1)} disabled={first}>
            ↑
          </IconButton>
          <IconButton label="Move down" onClick={() => onMove(1)} disabled={last}>
            ↓
          </IconButton>
          {canDelete && (
            <button
              onClick={onRemove}
              aria-label="Delete entry"
              className="text-[12px] font-semibold text-critical underline-offset-2 hover:underline"
            >
              ✕
            </button>
          )}
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {block.type === "link" && (
            <>
              <select
                value={block.badge ?? "LINK"}
                onChange={(e) =>
                  onChange({ ...block, badge: e.target.value as Badge })
                }
                className={inputClass}
                aria-label="Badge"
              >
                {BADGES.map((badge) => (
                  <option key={badge} value={badge}>
                    {badge}
                  </option>
                ))}
              </select>
              <input
                value={block.url ?? ""}
                onChange={(e) =>
                  onChange({ ...block, url: e.target.value || undefined })
                }
                placeholder="https://"
                className={inputClass}
                aria-label="Link"
              />
              <input
                value={block.description ?? ""}
                onChange={(e) =>
                  onChange({ ...block, description: e.target.value || undefined })
                }
                placeholder="One-line description"
                className={`${inputClass} sm:col-span-2`}
                aria-label="Description"
              />
            </>
          )}

          {block.type === "video" && (
            <>
              <input
                value={block.embed ?? ""}
                onChange={(e) =>
                  onChange({ ...block, embed: e.target.value || undefined })
                }
                placeholder="Loom, YouTube, Vimeo or Drive URL"
                className={`${inputClass} sm:col-span-2`}
                aria-label="Video URL"
              />
              <textarea
                value={block.body ?? ""}
                onChange={(e) =>
                  onChange({ ...block, body: e.target.value || undefined })
                }
                rows={3}
                placeholder="The written steps beside the video"
                className={`${inputClass} sm:col-span-2`}
                aria-label="Body"
              />
            </>
          )}

          {block.type === "call" && (
            <>
              <input
                value={block.time ?? ""}
                onChange={(e) =>
                  onChange({ ...block, time: e.target.value || undefined })
                }
                placeholder="Every weekday at 9:00am"
                className={inputClass}
                aria-label="When"
              />
              <input
                value={block.url ?? ""}
                onChange={(e) =>
                  onChange({ ...block, url: e.target.value || undefined })
                }
                placeholder="https:// join link"
                className={inputClass}
                aria-label="Join link"
              />
              <input
                value={block.description ?? ""}
                onChange={(e) =>
                  onChange({ ...block, description: e.target.value || undefined })
                }
                placeholder="Who runs it, what it covers"
                className={`${inputClass} sm:col-span-2`}
                aria-label="Description"
              />
            </>
          )}

          {block.type === "text" && (
            <textarea
              value={block.body ?? ""}
              onChange={(e) =>
                onChange({ ...block, body: e.target.value || undefined })
              }
              rows={4}
              placeholder="Write the note"
              className={`${inputClass} sm:col-span-2`}
              aria-label="Body"
            />
          )}

          {block.type === "tasks" && (
            <textarea
              value={(block.tasks ?? []).join("\n")}
              onChange={(e) =>
                onChange({
                  ...block,
                  tasks: e.target.value.split("\n").filter((l) => l.trim()),
                })
              }
              rows={4}
              placeholder="One step per line"
              className={`${inputClass} sm:col-span-2`}
              aria-label="Checklist steps"
            />
          )}
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------------- read mode -- */

  if (block.type === "text") {
    return (
      <Tile badge="TEXT" title={block.title}>
        {block.body && (
          <p className="mt-1.5 line-clamp-6 whitespace-pre-wrap text-[12.5px] text-ink-secondary">
            {block.body}
          </p>
        )}
      </Tile>
    );
  }

  if (block.type === "tasks") {
    return (
      <Tile badge="CHECKLIST" title={block.title}>
        <ul className="mt-1.5 space-y-1">
          {(block.tasks ?? []).map((step, i) => (
            <li key={i} className="flex items-start gap-2 text-[12.5px]">
              {/* Ticking is local to whoever is reading: one person working through a
                  list must not change what anyone else sees. */}
              <input type="checkbox" className="mt-0.5 shrink-0" />
              <span>{step}</span>
            </li>
          ))}
        </ul>
      </Tile>
    );
  }

  if (block.type === "call") {
    const joinHref = block.url ? safeHref(block.url) : null;
    return (
      <Tile badge="CALL" title={block.title}>
        {block.time && (
          <p className="mt-0.5 text-[12px] text-ink-muted">{block.time}</p>
        )}
        {block.description && (
          <p className="mt-0.5 text-[12px] text-ink-muted">{block.description}</p>
        )}
        {joinHref ? (
          <a
            href={joinHref}
            target="_blank"
            rel="noreferrer noopener"
            className="mt-2 inline-block rounded-full bg-ink px-3 py-1.5 text-[12px] font-bold text-page"
          >
            Join
          </a>
        ) : (
          <p className="mt-2 text-[12px] text-ink-muted">No link set</p>
        )}
      </Tile>
    );
  }

  if (block.type === "video") {
    const src = embedUrl(block.embed ?? "");
    return (
      <Tile badge="VIDEO" title={block.title}>
        {src ? (
          <div className="mt-2 aspect-video overflow-hidden rounded-lg border border-subtle">
            <iframe
              src={src}
              title={block.title}
              allowFullScreen
              className="size-full"
            />
          </div>
        ) : (
          <p className="mt-1 text-[12px] text-ink-muted">Video not set.</p>
        )}
        {block.body && (
          <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-[12.5px] text-ink-secondary">
            {block.body}
          </p>
        )}
      </Tile>
    );
  }

  const href = block.url ? safeHref(block.url) : null;
  return (
    <Tile badge={block.badge ?? "LINK"} title={block.title} href={href}>
      {block.description && (
        <p className="mt-1 text-[12.5px] text-ink-muted">{block.description}</p>
      )}
      {!href && (
        <p className="mt-1 text-[12px] text-ink-muted italic">Link not set</p>
      )}
    </Tile>
  );
}

/**
 * One tile.
 *
 * The whole tile is the target when there is somewhere to go — a card you can only
 * activate by hitting its title is a card that feels broken on a phone. Rendered as an
 * anchor in that case so it keeps middle-click, "open in new tab" and focus for free.
 */
function Tile({
  badge,
  title,
  href,
  children,
}: {
  badge: string;
  title: string;
  href?: string | null;
  children?: React.ReactNode;
}) {
  const body = (
    <>
      <span className="inline-block rounded border border-subtle px-1.5 py-0.5 text-[10px] font-bold tracking-widest text-ink-muted uppercase">
        {badge}
      </span>
      <h4 className="mt-2 text-[13.5px] font-bold tracking-tight text-pretty">
        {title}
      </h4>
      {children}
    </>
  );

  const shell =
    "block h-full rounded-xl border border-subtle bg-surface px-3.5 py-3 transition-colors";

  return href ? (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className={`${shell} hover:border-strong`}
    >
      {body}
    </a>
  ) : (
    <div className={shell}>{body}</div>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="grid size-7 shrink-0 place-items-center rounded-full border border-subtle text-[12px] text-ink-secondary transition-colors hover:border-strong hover:text-ink disabled:opacity-30"
    >
      {children}
    </button>
  );
}

/**
 * Turns a pasted share link into something an iframe will actually play.
 *
 * Only the four hosts that get used here, and only ones recognised by shape — an
 * arbitrary URL is never framed, because that is how a page ends up embedding whatever
 * someone pasted into it.
 */
function embedUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;

  const host = url.hostname.replace(/^www\./, "");

  if (host === "loom.com" || host.endsWith(".loom.com")) {
    const id = url.pathname.split("/").filter(Boolean).pop();
    return id ? `https://www.loom.com/embed/${id}` : null;
  }
  if (host === "youtube.com") {
    const id = url.searchParams.get("v");
    return id ? `https://www.youtube.com/embed/${id}` : null;
  }
  if (host === "youtu.be") {
    const id = url.pathname.slice(1);
    return id ? `https://www.youtube.com/embed/${id}` : null;
  }
  if (host === "vimeo.com") {
    const id = url.pathname.split("/").filter(Boolean).pop();
    return id && /^\d+$/.test(id) ? `https://player.vimeo.com/video/${id}` : null;
  }
  if (host === "drive.google.com") {
    const match = url.pathname.match(/\/file\/d\/([^/]+)/);
    return match ? `https://drive.google.com/file/d/${match[1]}/preview` : null;
  }
  return null;
}
