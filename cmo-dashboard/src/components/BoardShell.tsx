"use client";

import { useState, useTransition, type ReactNode } from "react";

import { saveBoardLayout } from "@/app/actions/board";
import {
  defaultLayout,
  defaultTitle,
  type Panel,
  type PanelKind,
} from "@/lib/board";

import { ghostButtonClass, inputClass, primaryButtonClass } from "./ui";

/**
 * The board's layout: which panels, in what order, under what heading.
 *
 * Panels arrive as ready-made server-rendered nodes in `slots` and this only decides
 * where they go. That split is the point — the layout is a client concern (dragging,
 * typing a heading) while the contents stay server components that talk to the database
 * directly, so making the board rearrangeable did not turn the whole page into client
 * JavaScript.
 *
 * Reordering is plain HTML5 drag on a handle rather than a library: the handle is the
 * only draggable part, so the inputs, selects and links inside a panel still behave
 * normally while edit mode is on.
 */
export function BoardShell({
  initialPanels,
  slots,
  dashboardSlug,
  editable,
}: {
  initialPanels: Panel[];
  slots: Partial<Record<PanelKind, ReactNode>>;
  dashboardSlug: string;
  editable: boolean;
}) {
  const [panels, setPanels] = useState<Panel[]>(initialPanels);
  const [editing, setEditing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [dragging, setDragging] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  const update = (next: Panel[]) => {
    setPanels(next);
    setDirty(true);
  };

  const save = () => {
    startTransition(async () => {
      await saveBoardLayout(dashboardSlug, JSON.stringify({ panels }));
      setDirty(false);
      setEditing(false);
    });
  };

  const reset = () => {
    update(defaultLayout().panels);
  };

  const move = (from: number, to: number) => {
    if (to < 0 || to >= panels.length || from === to) return;
    const next = [...panels];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    update(next);
  };

  const visible = panels.filter((p) => !p.hidden);

  return (
    <div>
      {editable && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {editing ? (
            <>
              <button
                onClick={save}
                disabled={pending || !dirty}
                className={primaryButtonClass}
              >
                {pending ? "Saving…" : dirty ? "Save layout" : "Saved"}
              </button>
              <button
                onClick={() => {
                  setPanels(initialPanels);
                  setDirty(false);
                  setEditing(false);
                }}
                className={ghostButtonClass}
              >
                Cancel
              </button>
              <button onClick={reset} className={ghostButtonClass}>
                Reset to default
              </button>
              <span className="text-[12px] text-ink-muted">
                Drag ⠿ to reorder · rename any heading · hide what you don&rsquo;t use
              </span>
            </>
          ) : (
            <button onClick={() => setEditing(true)} className={ghostButtonClass}>
              Edit layout
            </button>
          )}
        </div>
      )}

      <div className="space-y-6">
        {(editing ? panels : visible).map((panel) => {
          const index = panels.indexOf(panel);
          return (
            <section
              key={panel.kind}
              onDragOver={(event) => {
                if (!editing) return;
                if (!event.dataTransfer.types.includes("text/panel")) return;
                event.preventDefault();
                setOverIndex(index);
              }}
              onDrop={(event) => {
                if (!editing) return;
                event.preventDefault();
                if (dragging !== null) move(dragging, index);
                setDragging(null);
                setOverIndex(null);
              }}
              className={`${
                overIndex === index && dragging !== null && dragging !== index
                  ? "rounded-xl outline-2 outline-offset-4 outline-accent-edge"
                  : ""
              } ${editing && panel.hidden ? "opacity-45" : ""}`}
            >
              <header className="mb-2 flex flex-wrap items-center gap-2">
                {editing ? (
                  <>
                    <span
                      draggable
                      onDragStart={(event) => {
                        event.dataTransfer.setData("text/panel", panel.kind);
                        event.dataTransfer.effectAllowed = "move";
                        setDragging(index);
                      }}
                      onDragEnd={() => {
                        setDragging(null);
                        setOverIndex(null);
                      }}
                      aria-label={`Drag ${panel.title || panel.kind}`}
                      className="cursor-grab select-none px-1 text-[15px] text-ink-muted active:cursor-grabbing"
                    >
                      ⠿
                    </span>

                    <input
                      value={panel.title}
                      onChange={(event) =>
                        update(
                          panels.map((p) =>
                            p.kind === panel.kind
                              ? { ...p, title: event.target.value }
                              : p,
                          ),
                        )
                      }
                      placeholder={defaultTitle(panel.kind)}
                      aria-label={`Heading for ${panel.kind}`}
                      className={`${inputClass} w-56 font-bold`}
                    />

                    <span className="flex items-center gap-1">
                      <ArrowButton
                        label="Move panel up"
                        onClick={() => move(index, index - 1)}
                        disabled={index === 0}
                      >
                        ↑
                      </ArrowButton>
                      <ArrowButton
                        label="Move panel down"
                        onClick={() => move(index, index + 1)}
                        disabled={index === panels.length - 1}
                      >
                        ↓
                      </ArrowButton>
                    </span>

                    <button
                      onClick={() =>
                        update(
                          panels.map((p) =>
                            p.kind === panel.kind
                              ? { ...p, hidden: !p.hidden }
                              : p,
                          ),
                        )
                      }
                      className="text-[12px] font-semibold text-ink-muted underline-offset-2 hover:text-ink hover:underline"
                    >
                      {panel.hidden ? "Show" : "Hide"}
                    </button>
                  </>
                ) : (
                  panel.title.trim() !== "" && (
                    <h2 className="text-[15px] font-bold tracking-tight">
                      {panel.title}
                    </h2>
                  )
                )}
              </header>

              {slots[panel.kind]}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function ArrowButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="grid size-7 place-items-center rounded-full border border-subtle text-[12px] text-ink-secondary transition-colors hover:border-strong hover:text-ink disabled:opacity-30"
    >
      {children}
    </button>
  );
}
