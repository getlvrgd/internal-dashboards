"use client";

import { useState, useTransition } from "react";

import { saveSopContent } from "@/app/actions/sops";
import { safeHref } from "@/lib/links";
import {
  BADGES,
  newId,
  type Badge,
  type SopBlock,
  type SopContent,
  type SopPage,
  type SopSection,
} from "@/lib/sops";

import { EmptyNote, ghostButtonClass, inputClass, primaryButtonClass } from "./ui";

/**
 * The SOP library: reader and editor in one component.
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
export function SopLibrary({
  content: initial,
  dashboardSlug,
  canEdit,
}: {
  content: SopContent;
  dashboardSlug: string;
  canEdit: boolean;
}) {
  const [content, setContent] = useState<SopContent>(initial);
  const [editing, setEditing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const update = (next: SopContent) => {
    setContent(next);
    setDirty(true);
  };

  const mapSections = (fn: (sections: SopSection[]) => SopSection[]) =>
    update({ ...content, sections: fn(content.sections) });

  const save = () => {
    setError(null);
    startTransition(async () => {
      const result = await saveSopContent(dashboardSlug, JSON.stringify(content));
      if (result?.error) {
        setError(result.error);
        return;
      }
      setDirty(false);
      setEditing(false);
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
                  mapSections((s) => [
                    ...s,
                    { id: newId(), title: "New area", pages: [] },
                  ])
                }
                className={ghostButtonClass}
              >
                + Area
              </button>
              {dirty && (
                <span className="text-[12px] text-ink-muted">
                  Unsaved changes
                </span>
              )}
            </>
          ) : (
            <button onClick={() => setEditing(true)} className={ghostButtonClass}>
              Edit library
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
      {content.sections.length > 1 && !editing && (
        <nav className="scroll-x mb-6 flex gap-1.5 pb-1">
          {content.sections.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              className="shrink-0 rounded-full border border-subtle px-2.5 py-1 text-[12px] font-semibold text-ink-secondary transition-colors hover:border-strong hover:text-ink"
            >
              {section.title}
              <span className="ml-1 text-ink-muted tabular">
                {section.pages.reduce((n, p) => n + p.blocks.length, 0)}
              </span>
            </a>
          ))}
        </nav>
      )}

      {content.sections.length === 0 ? (
        <EmptyNote>
          Nothing in the library yet.
          {canEdit && " Use “Edit library” to add the first area."}
        </EmptyNote>
      ) : (
        <div className="space-y-8">
          {content.sections.map((section, sectionIndex) => (
            <SectionView
              key={section.id}
              section={section}
              editing={editing}
              onChange={(next) =>
                mapSections((s) =>
                  s.map((x, i) => (i === sectionIndex ? next : x)),
                )
              }
              onRemove={() =>
                mapSections((s) => s.filter((_, i) => i !== sectionIndex))
              }
              onMove={(delta) =>
                mapSections((s) => move(s, sectionIndex, delta))
              }
              first={sectionIndex === 0}
              last={sectionIndex === content.sections.length - 1}
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

function SectionView({
  section,
  editing,
  onChange,
  onRemove,
  onMove,
  first,
  last,
}: {
  section: SopSection;
  editing: boolean;
  onChange: (next: SopSection) => void;
  onRemove: () => void;
  onMove: (delta: number) => void;
  first: boolean;
  last: boolean;
}) {
  const setPages = (pages: SopPage[]) => onChange({ ...section, pages });

  return (
    <section id={section.id} className="scroll-mt-20">
      <div className="mb-3 flex flex-wrap items-center gap-2 border-b border-subtle pb-2">
        {editing ? (
          <input
            value={section.title}
            onChange={(e) => onChange({ ...section, title: e.target.value })}
            className={`${inputClass} flex-1 font-bold`}
            aria-label="Area name"
          />
        ) : (
          <h2 className="flex-1 text-[17px] font-bold tracking-tight">
            {section.title}
          </h2>
        )}

        <span className="text-[12px] text-ink-muted tabular">
          {section.pages.reduce((n, p) => n + p.blocks.length, 0)}
        </span>

        {editing && (
          <span className="flex items-center gap-1">
            <IconButton label="Move area up" onClick={() => onMove(-1)} disabled={first}>
              ↑
            </IconButton>
            <IconButton label="Move area down" onClick={() => onMove(1)} disabled={last}>
              ↓
            </IconButton>
            <button
              onClick={() =>
                setPages([
                  ...section.pages,
                  { id: newId(), title: "New page", blocks: [] },
                ])
              }
              className={ghostButtonClass}
            >
              + Page
            </button>
            <button
              onClick={() => {
                if (window.confirm(`Delete “${section.title}” and its pages?`)) {
                  onRemove();
                }
              }}
              className="text-[12px] font-semibold text-critical underline-offset-2 hover:underline"
            >
              Delete
            </button>
          </span>
        )}
      </div>

      {section.pages.length === 0 ? (
        <EmptyNote>Nothing in this area yet.</EmptyNote>
      ) : (
        <div className="space-y-4">
          {section.pages.map((page, pageIndex) => (
            <PageView
              key={page.id}
              page={page}
              editing={editing}
              onChange={(next) =>
                setPages(section.pages.map((p, i) => (i === pageIndex ? next : p)))
              }
              onRemove={() =>
                setPages(section.pages.filter((_, i) => i !== pageIndex))
              }
              onMove={(delta) => setPages(move(section.pages, pageIndex, delta))}
              first={pageIndex === 0}
              last={pageIndex === section.pages.length - 1}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function PageView({
  page,
  editing,
  onChange,
  onRemove,
  onMove,
  first,
  last,
}: {
  page: SopPage;
  editing: boolean;
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
    <article className="rounded-xl border border-subtle bg-surface p-4">
      <header className="mb-3 flex flex-wrap items-start gap-2">
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
              <h3 className="text-[15px] font-bold tracking-tight">
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
            <IconButton label="Move page up" onClick={() => onMove(-1)} disabled={first}>
              ↑
            </IconButton>
            <IconButton label="Move page down" onClick={() => onMove(1)} disabled={last}>
              ↓
            </IconButton>
            <button
              onClick={() => {
                if (window.confirm(`Delete the page “${page.title}”?`)) onRemove();
              }}
              className="text-[12px] font-semibold text-critical underline-offset-2 hover:underline"
            >
              Delete
            </button>
          </span>
        )}
      </header>

      {page.blocks.length === 0 && !editing && (
        <EmptyNote>Nothing here yet.</EmptyNote>
      )}

      <div className="space-y-2.5">
        {page.blocks.map((block, blockIndex) => (
          <BlockView
            key={block.id}
            block={block}
            editing={editing}
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
  onChange,
  onRemove,
  onMove,
  first,
  last,
}: {
  block: SopBlock;
  editing: boolean;
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
          <button
            onClick={onRemove}
            aria-label="Delete entry"
            className="text-[12px] font-semibold text-critical underline-offset-2 hover:underline"
          >
            ✕
          </button>
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
      <div className="rounded-lg border border-subtle px-3 py-2.5">
        <h4 className="text-[13px] font-bold">{block.title}</h4>
        {block.body && (
          <p className="mt-1 whitespace-pre-wrap text-[13px] text-ink-secondary">
            {block.body}
          </p>
        )}
      </div>
    );
  }

  if (block.type === "tasks") {
    return (
      <div className="rounded-lg border border-subtle px-3 py-2.5">
        <h4 className="text-[13px] font-bold">{block.title}</h4>
        <ul className="mt-1.5 space-y-1">
          {(block.tasks ?? []).map((step, i) => (
            <li key={i} className="flex items-start gap-2 text-[13px]">
              {/* Ticking is local to whoever is reading: one person working through a
                  list must not change what anyone else sees. */}
              <input type="checkbox" className="mt-0.5 shrink-0" />
              <span>{step}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (block.type === "call") {
    const joinHref = block.url ? safeHref(block.url) : null;
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-subtle px-3 py-2.5">
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-semibold">{block.title}</span>
          {block.time && (
            <span className="block text-[12px] text-ink-muted">{block.time}</span>
          )}
          {block.description && (
            <span className="block text-[12px] text-ink-muted">
              {block.description}
            </span>
          )}
        </span>
        {joinHref ? (
          <a
            href={joinHref}
            target="_blank"
            rel="noreferrer noopener"
            className="shrink-0 rounded-full bg-ink px-3 py-1.5 text-[12px] font-bold text-page"
          >
            Join
          </a>
        ) : (
          <span className="shrink-0 text-[12px] text-ink-muted">
            No link set
          </span>
        )}
      </div>
    );
  }

  if (block.type === "video") {
    const src = embedUrl(block.embed ?? "");
    return (
      <div className="rounded-lg border border-subtle px-3 py-2.5">
        <h4 className="text-[13px] font-bold">{block.title}</h4>
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
          <p className="mt-2 whitespace-pre-wrap text-[13px] text-ink-secondary">
            {block.body}
          </p>
        )}
      </div>
    );
  }

  const href = block.url ? safeHref(block.url) : null;
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-subtle px-3 py-2.5">
      <span className="mt-0.5 shrink-0 rounded border border-subtle px-1.5 py-0.5 text-[10px] font-bold tracking-widest text-ink-muted uppercase">
        {block.badge ?? "LINK"}
      </span>
      <span className="min-w-0 flex-1">
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noreferrer noopener"
            className="text-[13px] font-semibold underline-offset-2 hover:underline"
          >
            {block.title}
          </a>
        ) : (
          <span className="text-[13px] font-semibold text-ink-muted">
            {block.title} — link not set
          </span>
        )}
        {block.description && (
          <span className="mt-0.5 block text-[12.5px] text-ink-muted">
            {block.description}
          </span>
        )}
      </span>
    </div>
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
