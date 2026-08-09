"use client";

import { useState } from "react";

import { AddTaskForm } from "./AddTaskForm";
import { TaskRow, type RowOption } from "./TaskRow";
import { useTaskStore } from "./TaskStore";
import type { BoardTask } from "@/lib/tasks";
import { EmptyNote } from "./ui";

/**
 * One droppable list of tasks — a day of the week, or the daily list when `day` is
 * "today".
 *
 * The rows come from the shared store rather than props, which is what lets the same
 * task appear in the daily list and in its day on the week and stay in step: ticking it
 * in one strikes it through in the other in the same frame, because there is one piece
 * of state behind both.
 *
 * Drag and drop is plain HTML5 rather than a library. That is what makes dragging
 * *between* lists work without them sharing a React tree: the task id travels in
 * dataTransfer, so the panels can sit anywhere in the layout, in any order.
 *
 * The drop index is worked out from which row you are over, not from pointer maths:
 * hovering a row means "before it", and dropping past the last one appends.
 */
export function TaskList({
  tasks,
  day,
  clients,
  people,
  emptyNote,
  defaultClientId,
  defaultAssigneeId,
}: {
  tasks: BoardTask[];
  /** The day a drop lands on. Null is the unscheduled case. */
  day: number | null;
  clients: RowOption[];
  people: RowOption[];
  emptyNote: string;
  defaultClientId?: string;
  defaultAssigneeId?: string;
}) {
  const { canEdit, move } = useTaskStore();
  const [overIndex, setOverIndex] = useState<number | null>(null);

  const drop = (index: number) => (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setOverIndex(null);

    const id = event.dataTransfer.getData("text/task-id");
    if (!id) return;
    move(id, day, index);
  };

  const allow = (index: number) => (event: React.DragEvent) => {
    // Only claim the drop when a task is what is being dragged — otherwise dragging a
    // link or a file over the board would look droppable and then do nothing.
    if (!event.dataTransfer.types.includes("text/task-id")) return;
    event.preventDefault();
    event.stopPropagation();
    setOverIndex(index);
  };

  return (
    <ul
      className="border-t border-subtle"
      onDragOver={canEdit ? allow(tasks.length) : undefined}
      onDrop={canEdit ? drop(tasks.length) : undefined}
      onDragLeave={() => setOverIndex(null)}
    >
      {tasks.length === 0 && !canEdit && (
        <li className="px-3">
          <EmptyNote>{emptyNote}</EmptyNote>
        </li>
      )}

      {tasks.map((task, index) => (
        <li
          key={task.id}
          draggable={canEdit}
          onDragStart={(event) => {
            event.dataTransfer.setData("text/task-id", task.id);
            event.dataTransfer.effectAllowed = "move";
          }}
          onDragOver={canEdit ? allow(index) : undefined}
          onDrop={canEdit ? drop(index) : undefined}
          className={
            overIndex === index ? "border-t-2 border-t-accent-edge" : undefined
          }
        >
          {/* TaskRow renders a <div>, never an <li> — the list item is owned here so it
              can be the drop target, and nesting one inside another is invalid HTML
              that fails hydration and silently unbinds every handler on the board. */}
          <TaskRow
            task={task}
            clients={clients}
            people={people}
            editable={canEdit}
          />
        </li>
      ))}

      {canEdit && (
        <li
          className={
            overIndex === tasks.length
              ? "border-t-2 border-t-accent-edge"
              : undefined
          }
        >
          <AddTaskForm
            day={day}
            clients={clients}
            people={people}
            defaultClientId={defaultClientId}
            defaultAssigneeId={defaultAssigneeId}
          />
        </li>
      )}
    </ul>
  );
}
