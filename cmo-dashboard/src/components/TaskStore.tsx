"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useOptimistic,
  useTransition,
  type ReactNode,
} from "react";

import {
  createTask,
  moveTask,
  patchTask,
  removeTask,
  setTaskDone,
  setTaskRecurring,
} from "@/app/actions/tasks";
import { TASK_STATUS } from "@/lib/options";
import type { BoardTask } from "@/lib/tasks";

/**
 * Every task on the board, held once and shared by every panel.
 *
 * Two things force this to be one store rather than state per list:
 *
 *   1. The same task appears twice. Today's tasks show in the daily list *and* in their
 *      day on the week, because they are one row rendered in two places. Ticking it in
 *      one has to strike it through in the other in the same frame, which cannot happen
 *      if each list keeps its own copy.
 *
 *   2. Changes have to look instant. Every edit is applied to local state first and the
 *      server is told afterwards — a write plus a revalidation is most of a second, and
 *      watching a tick land three beats after you clicked it makes the whole board feel
 *      broken.
 *
 * useOptimistic is what makes that safe: the local change lives only for the duration of
 * the transition, and when the server's version of the board arrives it replaces it. A
 * write that fails therefore corrects itself on the next render rather than leaving the
 * screen quietly disagreeing with the database.
 */

type Action =
  | { type: "add"; task: BoardTask }
  | { type: "done"; id: string; done: boolean }
  | { type: "recurring"; id: string; recurring: boolean }
  | { type: "remove"; id: string }
  | { type: "patch"; id: string; patch: Partial<BoardTask> }
  | { type: "move"; id: string; day: number | null; weekOf: string | null };

function reduce(tasks: BoardTask[], action: Action): BoardTask[] {
  switch (action.type) {
    case "add":
      return [...tasks, action.task];
    case "remove":
      return tasks.filter((t) => t.id !== action.id);
    case "done":
      return tasks.map((t) =>
        t.id === action.id
          ? {
              ...t,
              status: action.done
                ? TASK_STATUS.DONE
                : TASK_STATUS.NOT_STARTED,
            }
          : t,
      );
    case "recurring":
      return tasks.map((t) =>
        t.id === action.id ? { ...t, recurring: action.recurring } : t,
      );
    case "patch":
      return tasks.map((t) =>
        t.id === action.id ? { ...t, ...action.patch } : t,
      );
    case "move":
      return tasks.map((t) =>
        t.id === action.id
          ? { ...t, day: action.day, weekOf: action.weekOf }
          : t,
      );
  }
}

type StoreValue = {
  tasks: BoardTask[];
  canEdit: boolean;
  dashboardSlug: string;
  week: string;
  addTask: (input: {
    title: string;
    day: number | null;
    clientId: string;
    assigneeId: string;
    recurring?: boolean;
  }) => void;
  setDone: (id: string, done: boolean) => void;
  setRecurring: (id: string, recurring: boolean) => void;
  remove: (id: string) => void;
  patch: (id: string, patch: Partial<BoardTask>) => void;
  move: (id: string, day: number | null, index: number) => void;
};

const TaskStoreContext = createContext<StoreValue | null>(null);

export function useTaskStore() {
  const value = useContext(TaskStoreContext);
  if (!value) throw new Error("useTaskStore used outside TaskStoreProvider");
  return value;
}

export function TaskStoreProvider({
  tasks,
  dashboardSlug,
  week,
  canEdit,
  children,
}: {
  tasks: BoardTask[];
  dashboardSlug: string;
  week: string;
  canEdit: boolean;
  children: ReactNode;
}) {
  const [optimistic, apply] = useOptimistic(tasks, reduce);
  const [, startTransition] = useTransition();
  const router = useRouter();

  // revalidatePath marks the path stale, but the client Router Cache is keyed by the
  // full URL and the board is normally viewed at /d/<slug>?week=…. Without this the
  // optimistic value would be the only thing that ever changed.
  const run = useCallback(
    (optimisticAction: Action, serverCall: () => Promise<unknown>) => {
      startTransition(async () => {
        apply(optimisticAction);
        await serverCall();
        router.refresh();
      });
    },
    [apply, router],
  );

  const value: StoreValue = {
    tasks: optimistic,
    canEdit,
    dashboardSlug,
    week,

    addTask: ({ title, day, clientId, assigneeId, recurring = false }) => {
      const trimmed = title.trim();
      if (!trimmed) return;

      // A placeholder id, replaced the moment the server's board arrives. It only has
      // to be unique among the rows on screen for the length of one transition.
      const tempId = `optimistic-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

      const formData = new FormData();
      formData.set("title", trimmed);
      formData.set("day", day === null ? "" : String(day));
      formData.set("week", week);
      formData.set("clientId", clientId);
      formData.set("assigneeId", assigneeId);
      formData.set("priority", "NORMAL");
      // A task with no day cannot recur — there is no week for it to be copied into.
      if (recurring && day !== null) formData.set("recurring", "on");

      run(
        {
          type: "add",
          task: {
            id: tempId,
            title: trimmed,
            status: TASK_STATUS.NOT_STARTED,
            priority: "NORMAL",
            recurring: recurring && day !== null,
            clientId: clientId || null,
            assigneeId: assigneeId || null,
            day,
            weekOf: day === null ? null : week,
            position: Number.MAX_SAFE_INTEGER,
          },
        },
        () => createTask(dashboardSlug, formData),
      );
    },

    setDone: (id, done) =>
      run({ type: "done", id, done }, () =>
        setTaskDone(dashboardSlug, id, done),
      ),

    setRecurring: (id, recurring) =>
      run({ type: "recurring", id, recurring }, () =>
        setTaskRecurring(dashboardSlug, id, recurring),
      ),

    remove: (id) =>
      run({ type: "remove", id }, () => removeTask(dashboardSlug, id)),

    patch: (id, patch) =>
      run({ type: "patch", id, patch }, () =>
        patchTask(dashboardSlug, id, {
          title: patch.title,
          status: patch.status,
          priority: patch.priority,
          clientId: patch.clientId,
          assigneeId: patch.assigneeId,
        }),
      ),

    move: (id, day, index) =>
      run(
        { type: "move", id, day, weekOf: day === null ? null : week },
        () => moveTask(dashboardSlug, id, day, index, week),
      ),
  };

  return (
    <TaskStoreContext.Provider value={value}>
      {children}
    </TaskStoreContext.Provider>
  );
}

/* ------------------------------------------------------------------ selects -- */

// Re-exported so panels can pull the type and the slices from one place. The
// definitions live in src/lib/tasks.ts because the server page needs them too.
export type { BoardTask };
export { tasksForDay, tasksForToday } from "@/lib/tasks";
