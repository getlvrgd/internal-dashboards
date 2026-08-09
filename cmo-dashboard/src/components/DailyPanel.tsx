"use client";

import { DAYS, TASK_STATUS } from "@/lib/options";
import { tasksForToday } from "@/lib/tasks";

import { TaskList } from "./TaskList";
import type { RowOption } from "./TaskRow";
import { useTaskStore } from "./TaskStore";

/**
 * Today's list, with its own count.
 *
 * A client component so the count comes from the same state the rows do. Computing it
 * on the server would leave the header a round trip behind the list underneath it,
 * which reads as the number being broken rather than merely late.
 */
export function DailyPanel({
  today,
  clients,
  people,
  defaultClientId,
  defaultAssigneeId,
}: {
  today: number | null;
  clients: RowOption[];
  people: RowOption[];
  defaultClientId?: string;
  defaultAssigneeId?: string;
}) {
  const { tasks } = useTaskStore();
  const daily = tasksForToday(tasks, today);
  const done = daily.filter((t) => t.status === TASK_STATUS.DONE).length;

  return (
    <div className="overflow-hidden rounded-xl border border-subtle bg-surface">
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <span className="text-[12px] text-ink-muted">
          {today === null
            ? "Not tied to a week"
            : `${DAYS[today]} · also shown in the week`}
        </span>
        <span className="text-[12px] text-ink-muted tabular">
          {done}/{daily.length}
        </span>
      </div>

      <TaskList
        scope={{ kind: "today", today }}
        clients={clients}
        people={people}
        emptyNote="Nothing on today."
        defaultClientId={defaultClientId}
        defaultAssigneeId={defaultAssigneeId}
      />
    </div>
  );
}
