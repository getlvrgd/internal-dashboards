"use client";

import { useRef, useTransition } from "react";

import { createTask } from "@/app/actions/tasks";

import type { RowOption } from "./TaskRow";

/**
 * The "add a task" line at the foot of each day.
 *
 * A client component only so the form can be cleared and the caret put back after a
 * submit — adding five tasks to a Monday should be five sentences and four Enters, not a
 * click back into the field each time. The write itself is still the server action.
 *
 * Client and person default to whatever the board is filtered by, so filtering to one
 * client and adding three tasks does not mean setting the client three times.
 */
export function AddTaskForm({
  day,
  week,
  clients,
  people,
  defaultClientId,
  defaultAssigneeId,
  dashboardSlug,
}: {
  day: number | null;
  week: string;
  clients: RowOption[];
  people: RowOption[];
  defaultClientId?: string;
  defaultAssigneeId?: string;
  dashboardSlug: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      ref={formRef}
      action={(formData) => {
        // Cleared optimistically rather than after the await: the row is appended by the
        // revalidation a moment later, and leaving the text sitting there until then
        // reads as though the submit did not take.
        formRef.current?.reset();
        startTransition(async () => {
          await createTask(dashboardSlug, formData);
          titleRef.current?.focus();
        });
      }}
      className="flex flex-wrap items-center gap-1.5 border-t border-subtle px-2 py-1.5"
    >
      <input type="hidden" name="day" value={day ?? ""} />
      <input type="hidden" name="week" value={week} />

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
        disabled={pending}
        className="shrink-0 rounded-md px-2 py-1 text-[12px] font-semibold text-ink-secondary transition-colors hover:text-ink disabled:opacity-50"
      >
        Add
      </button>
    </form>
  );
}

const selectClass =
  "shrink-0 rounded-md border border-transparent bg-transparent px-1 py-1 text-[12px] text-ink-secondary outline-none hover:border-subtle focus:border-accent";
