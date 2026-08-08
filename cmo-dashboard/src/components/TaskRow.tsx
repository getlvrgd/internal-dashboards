import {
  deleteTask,
  toggleDone,
  toggleRecurring,
  updateTask,
} from "@/app/actions/tasks";
import {
  PRIORITIES,
  TASK_STATUS,
  TASK_STATUSES,
  taskStatusLabel,
  taskStatusTint,
} from "@/lib/options";

import { AutoSubmitSelect } from "./AutoSubmitSelect";
import { InlineText } from "./InlineText";
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
 */
export function TaskRow({
  task,
  clients,
  people,
  editable,
}: {
  task: TaskRowData;
  clients: RowOption[];
  people: RowOption[];
  editable: boolean;
}) {
  const done = task.status === TASK_STATUS.DONE;
  const clientName = clients.find((c) => c.value === task.clientId)?.label;
  const personName = people.find((p) => p.value === task.assigneeId)?.label;

  if (!editable) {
    return (
      <li className="flex items-center gap-2 border-t border-subtle px-2 py-2 text-[13px] first:border-t-0">
        <Dot tint={taskStatusTint(task.status)} />
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
      </li>
    );
  }

  return (
    <li className="group flex flex-wrap items-center gap-1.5 border-t border-subtle px-2 py-1.5 text-[13px] first:border-t-0 sm:flex-nowrap">
      <form action={toggleDone} className="flex shrink-0 items-center">
        <input type="hidden" name="id" value={task.id} />
        <button
          type="submit"
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
      </form>

      {/* Every editable field posts together; AutoSubmitSelect and InlineText both
          submit this form, and updateTask writes only the keys it is given. */}
      <form
        action={updateTask}
        className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 sm:flex-nowrap"
      >
        <input type="hidden" name="id" value={task.id} />

        <InlineText
          name="title"
          defaultValue={task.title}
          ariaLabel="Task"
          className={`flex-1 text-[13px] ${done ? "text-ink-muted line-through" : ""}`}
        />

        <AutoSubmitSelect
          name="clientId"
          value={task.clientId ?? ""}
          ariaLabel="Client"
          className={`${selectClass} w-[9rem] shrink-0`}
        >
          <option value="">No client</option>
          {clients.map((client) => (
            <option key={client.value} value={client.value}>
              {client.label}
            </option>
          ))}
        </AutoSubmitSelect>

        <AutoSubmitSelect
          name="assigneeId"
          value={task.assigneeId ?? ""}
          ariaLabel="Person responsible"
          className={`${selectClass} w-[8rem] shrink-0`}
        >
          <option value="">Unassigned</option>
          {people.map((person) => (
            <option key={person.value} value={person.value}>
              {person.label}
            </option>
          ))}
        </AutoSubmitSelect>

        <AutoSubmitSelect
          name="priority"
          value={task.priority}
          ariaLabel="Priority"
          options={PRIORITIES}
          className={`${selectClass} w-[5.5rem] shrink-0`}
        />

        <AutoSubmitSelect
          name="status"
          value={task.status}
          ariaLabel="Status"
          options={TASK_STATUSES}
          className={`${selectClass} w-[7rem] shrink-0`}
        />
      </form>

      <div className="flex shrink-0 items-center gap-0.5">
        <form action={toggleRecurring}>
          <input type="hidden" name="id" value={task.id} />
          <button
            type="submit"
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
        </form>

        <form action={deleteTask}>
          <input type="hidden" name="id" value={task.id} />
          <button
            type="submit"
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
        </form>
      </div>
    </li>
  );
}

const selectClass =
  "rounded-md border border-transparent bg-transparent px-1 py-1 text-[12px] text-ink-secondary outline-none hover:border-subtle focus:border-accent";
