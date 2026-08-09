"use client";

import { TASK_STATUS } from "@/lib/options";
import { tasksForToday } from "@/lib/tasks";

import { ProgressPanel } from "./ProgressPanel";
import { useTaskStore } from "./TaskStore";

/**
 * The progress bar, reading the same state the daily list does.
 *
 * It has to move the instant a box is ticked — a progress bar that catches up a second
 * later is worse than none, because you tick something and watch the number disagree
 * with the row you just struck through.
 */
export function DailyProgress({ today }: { today: number | null }) {
  const { tasks } = useTaskStore();
  const daily = tasksForToday(tasks, today);
  const done = daily.filter((t) => t.status === TASK_STATUS.DONE).length;

  return <ProgressPanel done={done} total={daily.length} />;
}
