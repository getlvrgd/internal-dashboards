"use client";

import { useRef } from "react";

import { useTaskStore } from "./TaskStore";
import type { RowOption } from "./TaskRow";

/**
 * The "add a task" line at the foot of each day.
 *
 * Adding five tasks to a Monday should be five sentences and four Enters, not a click
 * back into the field each time — so the row clears itself and keeps the caret.
 *
 * The row appears immediately: the store adds it locally and tells the server after, so
 * there is no pause between pressing Enter and seeing the task.
 *
 * Client and person default to whatever the board is filtered by, so filtering to one
 * client and adding three tasks does not mean setting the client three times.
 */
export function AddTaskForm({
  day,
  clients,
  people,
  defaultClientId,
  defaultAssigneeId,
}: {
  day: number | null;
  clients: RowOption[];
  people: RowOption[];
  defaultClientId?: string;
  defaultAssigneeId?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const { addTask } = useTaskStore();

  return (
    <form
      ref={formRef}
      action={(formData) => {
        const title = String(formData.get("title") ?? "").trim();
        // Nothing to do, and submitting anyway would clear the row and look like a
        // task had been swallowed.
        if (!title) return;

        addTask({
          title,
          day,
          clientId: String(formData.get("clientId") ?? ""),
          assigneeId: String(formData.get("assigneeId") ?? ""),
          recurring: formData.get("recurring") === "on",
        });

        // Safe to clear straight away: the row is already on screen from the optimistic
        // add, and if the write fails the board reconciles to the server's version.
        formRef.current?.reset();
        titleRef.current?.focus();
      }}
      className="flex flex-wrap items-center gap-1.5 border-t border-subtle px-2 py-1.5"
    >
      <span aria-hidden className="grid size-[18px] place-items-center text-ink-muted">
        <svg viewBox="0 0 16 16" className="size-3.5">
          <path
            d="M8 3.5v9M3.5 8h9"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </svg>
      </span>

      <input
        ref={titleRef}
        name="title"
        required
        maxLength={200}
        placeholder={day === null ? "Add a to-do…" : "Add a task…"}
        aria-label="New task"
        className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1.5 py-1 text-[13px] outline-none placeholder:text-ink-muted hover:border-subtle focus:border-accent focus:bg-surface"
      />

      <select
        name="clientId"
        defaultValue={defaultClientId ?? ""}
        aria-label="Client"
        className={selectClass}
      >
        <option value="">No client</option>
        {clients.map((client) => (
          <option key={client.value} value={client.value}>
            {client.label}
          </option>
        ))}
      </select>

      <select
        name="assigneeId"
        defaultValue={defaultAssigneeId ?? ""}
        aria-label="Person responsible"
        className={selectClass}
      >
        <option value="">Unassigned</option>
        {people.map((person) => (
          <option key={person.value} value={person.value}>
            {person.label}
          </option>
        ))}
      </select>

      {day !== null && (
        <label
          className="flex shrink-0 items-center gap-1 text-[12px] text-ink-muted"
          title="Copy this task into every following week"
        >
          <input type="checkbox" name="recurring" className="accent-[var(--accent)]" />
          Weekly
        </label>
      )}

      <button
        type="submit"
        className="shrink-0 rounded-md px-2 py-1 text-[12px] font-semibold text-ink-secondary transition-colors hover:text-ink"
      >
        Add
      </button>
    </form>
  );
}

const selectClass =
  "shrink-0 rounded-md border border-transparent bg-transparent px-1 py-1 text-[12px] text-ink-secondary outline-none hover:border-subtle focus:border-accent";
