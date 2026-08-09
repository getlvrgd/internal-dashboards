"use client";

import {
  PRIORITIES,
  TASK_STATUS,
  TASK_STATUSES,
  taskStatusLabel,
  taskStatusTint,
} from "@/lib/options";

import { InlineText } from "./InlineText";
import { useTaskStore } from "./TaskStore";
import type { BoardTask } from "@/lib/tasks";
import { Dot } from "./ui";

export type TaskRowData = {
  id: string;
  title: string;
  status: string;
  priority: string;
  recurring: boolean;
  clientId: string | null;
  assigneeId: string | null;
};

export type RowOption = { value: string; label: string; color?: string | null };

/**
 * One line on the board.
 *
 * Three forms rather than one, because forms cannot nest: the tick box and the recurring
 * and delete buttons each post on their own, while every field that can be edited shares
 * a single form so changing any one of them saves the row as a whole.
 *
 * A read-only viewer gets the same row with the controls swapped for plain text — not a
 * disabled version of them, which would be a row full of greyed-out furniture that never
 * does anything.
 *
 * The root is a <div>, not an <li>: TaskList owns the list item so it can make it a drop
 * target. Rendering an <li> here as well produced <li><li>…</li></li>, which is invalid
 * HTML — React fails hydration on it and discards the whole client tree, which silently
 * kills every button on the board.
 */
export function TaskRow({
  task,
  clients,
  people,
}: {
  task: BoardTask;
  clients: RowOption[];
  people: RowOption[];
}) {
  const { setDone, setRecurring, remove, patch, canManage, canTick } =
    useTaskStore();
  const done = task.status === TASK_STATUS.DONE;
  const clientName = clients.find((c) => c.value === task.clientId)?.label;
  const personName = people.find((p) => p.value === task.assigneeId)?.label;

  if (!canManage) {
    return (
      <div className="flex items-center gap-2 border-t border-subtle px-2 py-2 text-[13px] first:border-t-0">
        {/* A member gets the tick and nothing else: it is what they are here for, and
            it is the one control that cannot lose anyone's work. */}
        {canTick ? (
          <button
            type="button"
            onClick={() => setDone(task.id, !done)}
            aria-label={done ? `Reopen ${task.title}` : `Mark ${task.title} done`}
            title={done ? "Reopen" : "Mark done"}
            className={`grid size-[18px] shrink-0 place-items-center rounded-md border transition-colors ${
              done
                ? "border-transparent text-page"
                : "border-strong text-transparent hover:border-accent"
            }`}
            style={done ? { background: "var(--status-good)" } : undefined}
          >
            <svg viewBox="0 0 16 16" aria-hidden className="size-3 fill-none">
              <path
                d="M3.5 8.5l3 3 6-6.5"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        ) : (
          <Dot tint={taskStatusTint(task.status)} />
        )}
        <span className={`min-w-0 flex-1 truncate ${done ? "text-ink-muted line-through" : ""}`}>
          {task.title}
        </span>
        {clientName && (
          <span className="shrink-0 text-[12px] text-ink-secondary">{clientName}</span>
        )}
        {personName && (
          <span className="shrink-0 text-[12px] text-ink-muted">{personName}</span>
        )}
        <span className="shrink-0 text-[12px] text-ink-muted">
          {taskStatusLabel(task.status)}
        </span>
      </div>
    );
  }

  return (
    <div className="group flex flex-wrap items-center gap-1.5 border-t border-subtle px-2 py-1.5 text-[13px] first:border-t-0 sm:flex-nowrap">
      <span className="flex shrink-0 items-center">
        <button
          type="button"
          onClick={() => setDone(task.id, !done)}
          aria-label={done ? `Reopen ${task.title}` : `Mark ${task.title} done`}
          title={done ? "Reopen" : "Mark done"}
          className={`grid size-[18px] place-items-center rounded-md border transition-colors ${
            done
              ? "border-transparent text-page"
              : "border-strong text-transparent hover:border-accent"
          }`}
          style={done ? { background: "var(--status-good)" } : undefined}
        >
          <svg viewBox="0 0 16 16" aria-hidden className="size-3 fill-none">
            <path
              d="M3.5 8.5l3 3 6-6.5"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </span>

      {/* Every control writes through the store: local state first, server after, so a
          click lands in the same frame rather than a round trip later. */}
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 sm:flex-nowrap">
        <InlineText
          name="title"
          defaultValue={task.title}
          ariaLabel="Task"
          onCommit={(value) => patch(task.id, { title: value })}
          className={`flex-1 text-[13px] ${done ? "text-ink-muted line-through" : ""}`}
        />

        <select
          value={task.clientId ?? ""}
          onChange={(e) => patch(task.id, { clientId: e.target.value || null })}
          aria-label="Client"
          className={`${selectClass} w-[9rem] shrink-0`}
        >
          <option value="">No client</option>
          {clients.map((client) => (
            <option key={client.value} value={client.value}>
              {client.label}
            </option>
          ))}
        </select>

        <select
          value={task.assigneeId ?? ""}
          onChange={(e) => patch(task.id, { assigneeId: e.target.value || null })}
          aria-label="Person responsible"
          className={`${selectClass} w-[8rem] shrink-0`}
        >
          <option value="">Unassigned</option>
          {people.map((person) => (
            <option key={person.value} value={person.value}>
              {person.label}
            </option>
          ))}
        </select>

        <select
          value={task.priority}
          onChange={(e) => patch(task.id, { priority: e.target.value })}
          aria-label="Priority"
          className={`${selectClass} w-[5.5rem] shrink-0`}
        >
          {PRIORITIES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <select
          value={task.status}
          onChange={(e) => patch(task.id, { status: e.target.value })}
          aria-label="Status"
          className={`${selectClass} w-[7rem] shrink-0`}
        >
          {TASK_STATUSES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex shrink-0 items-center gap-0.5">
        <button
            type="button"
            onClick={() => setRecurring(task.id, !task.recurring)}
            title={
              task.recurring
                ? "Part of the weekly routine — copied into next week"
                : "Add to the weekly routine"
            }
            aria-label={
              task.recurring
                ? `Stop repeating ${task.title} weekly`
                : `Repeat ${task.title} weekly`
            }
            aria-pressed={task.recurring}
            className={`grid size-6 place-items-center rounded-md transition-colors ${
              task.recurring
                ? "text-accent"
                : "text-ink-muted opacity-0 hover:text-ink focus-visible:opacity-100 group-hover:opacity-100"
            }`}
          >
            <svg viewBox="0 0 16 16" aria-hidden className="size-3.5 fill-none">
              <path
                d="M2.6 6.6a5.5 5.5 0 0 1 9.5-2.2M13.4 9.4a5.5 5.5 0 0 1-9.5 2.2"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
              <path
                d="M2.2 3.2v3.4h3.4M13.8 12.8V9.4h-3.4"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

        <button
            type="button"
            onClick={() => remove(task.id)}
            aria-label={`Delete ${task.title}`}
            title="Delete"
            className="grid size-6 place-items-center rounded-md text-ink-muted transition-colors hover:text-critical"
          >
            <svg viewBox="0 0 16 16" aria-hidden className="size-3.5">
              <path
                d="M4 4l8 8M12 4l-8 8"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
              />
            </svg>
          </button>
      </div>
    </div>
  );
}

const selectClass =
  "rounded-md border border-transparent bg-transparent px-1 py-1 text-[12px] text-ink-secondary outline-none hover:border-subtle focus:border-accent";
