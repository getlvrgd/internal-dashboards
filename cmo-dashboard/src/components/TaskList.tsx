"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { moveTask } from "@/app/actions/tasks";

import { AddTaskForm } from "./AddTaskForm";
import { TaskRow, type RowOption, type TaskRowData } from "./TaskRow";
import { EmptyNote } from "./ui";

/**
 * One droppable list of tasks — a day, or the to-do list when `day` is null.
 *
 * Drag and drop is plain HTML5 rather than a library. That is what makes dragging
 * *between* lists work without them sharing a React tree: the task id travels in
 * dataTransfer, so the to-do panel and the week panel can sit anywhere in the layout,
 * in any order, and a drop still lands correctly.
 *
 * The drop index is worked out from which row you are over, not from pointer maths:
 * hovering the top half of a row means "before it", the bottom half means "after it".
 * Dropping on the empty space below the rows appends.
 */
export function TaskList({
  tasks,
  day,
  week,
  clients,
  people,
  editable,
  dashboardSlug,
  emptyNote,
  defaultClientId,
  defaultAssigneeId,
}: {
  tasks: TaskRowData[];
  day: number | null;
  week: string;
  clients: RowOption[];
  people: RowOption[];
  editable: boolean;
  dashboardSlug: string;
  emptyNote: string;
  defaultClientId?: string;
  defaultAssigneeId?: string;
}) {
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();

  const drop = (index: number) => (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setOverIndex(null);

    const id = event.dataTransfer.getData("text/task-id");
    if (!id) return;

    startTransition(async () => {
      await moveTask(dashboardSlug, id, day, index, week);
      // See AddTaskForm: the Router Cache is keyed by the full URL, and this board is
      // usually being viewed with a ?week= on it.
      router.refresh();
    });
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
      onDragOver={editable ? allow(tasks.length) : undefined}
      onDrop={editable ? drop(tasks.length) : undefined}
      onDragLeave={() => setOverIndex(null)}
    >
      {tasks.length === 0 && !editable && (
        <li className="px-3">
          <EmptyNote>{emptyNote}</EmptyNote>
        </li>
      )}

      {tasks.map((task, index) => (
        <li
          key={task.id}
          draggable={editable}
          onDragStart={(event) => {
            event.dataTransfer.setData("text/task-id", task.id);
            event.dataTransfer.effectAllowed = "move";
          }}
          onDragOver={editable ? allow(index) : undefined}
          onDrop={editable ? drop(index) : undefined}
          className={
            overIndex === index
              ? "border-t-2 border-t-accent-edge"
              : undefined
          }
        >
          <TaskRow
            task={task}
            clients={clients}
            people={people}
            editable={editable}
            dashboardSlug={dashboardSlug}
          />
        </li>
      ))}

      {editable && (
        <li
          className={
            overIndex === tasks.length ? "border-t-2 border-t-accent-edge" : undefined
          }
        >
          <AddTaskForm
            day={day}
            week={week}
            clients={clients}
            people={people}
            defaultClientId={defaultClientId}
            defaultAssigneeId={defaultAssigneeId}
            dashboardSlug={dashboardSlug}
          />
        </li>
      )}
    </ul>
  );
}
