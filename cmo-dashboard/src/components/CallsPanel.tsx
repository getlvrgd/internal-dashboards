import {
  createCall,
  deleteCall,
  moveCall,
  updateCall,
} from "@/app/actions/calls";
import { safeHref } from "@/lib/links";

import { DangerButton } from "./DangerButton";
import { EmptyNote, ghostButtonClass, inputClass, primaryButtonClass } from "./ui";

export type CallRow = {
  id: string;
  title: string;
  url: string | null;
  time: string | null;
  notes: string | null;
};

/**
 * The standing calls.
 *
 * The whole point is one click from the board into the call — so Join is a real button
 * on the row, not something behind an expander. When it happens is free text, because
 * "Every weekday at 9:00am" is what someone wants to read and a recurrence rule would
 * mean a scheduler and a timezone per person to render that sentence.
 */
export function CallsPanel({
  calls,
  dashboardSlug,
  editable,
}: {
  calls: CallRow[];
  dashboardSlug: string;
  editable: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-subtle bg-surface">
      {calls.length === 0 ? (
        <div className="px-3 py-2">
          <EmptyNote>No calls set up.</EmptyNote>
        </div>
      ) : (
        <ul>
          {calls.map((call, index) => {
            const href = call.url ? safeHref(call.url) : null;
            return (
              <li
                key={call.id}
                className="border-t border-subtle px-3 py-2.5 first:border-t-0"
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-semibold">
                      {call.title}
                    </span>
                    {call.time && (
                      <span className="block text-[12px] text-ink-muted">
                        {call.time}
                      </span>
                    )}
                  </span>

                  {href && (
                    <a
                      href={href}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="shrink-0 rounded-full bg-ink px-3 py-1.5 text-[12px] font-bold text-page"
                    >
                      Join
                    </a>
                  )}
                </div>

                {call.notes && (
                  <p className="mt-1 text-[12px] text-ink-muted">{call.notes}</p>
                )}

                {editable && (
                  <details className="group mt-1.5">
                    <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-[12px] font-semibold text-ink-muted transition-colors hover:text-ink">
                      <span className="transition-transform group-open:rotate-90">
                        ›
                      </span>
                      Edit
                    </summary>

                    <form
                      action={updateCall.bind(null, dashboardSlug)}
                      className="mt-2 grid gap-2 sm:grid-cols-2"
                    >
                      <input type="hidden" name="id" value={call.id} />
                      <input
                        name="title"
                        required
                        defaultValue={call.title}
                        placeholder="Daily stand-up"
                        className={inputClass}
                      />
                      <input
                        name="time"
                        defaultValue={call.time ?? ""}
                        placeholder="Every weekday at 9:00am"
                        className={inputClass}
                      />
                      <input
                        name="url"
                        defaultValue={call.url ?? ""}
                        placeholder="https:// join link"
                        className={inputClass}
                      />
                      <input
                        name="notes"
                        defaultValue={call.notes ?? ""}
                        placeholder="Who runs it, what it covers"
                        className={inputClass}
                      />

                      <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
                        <button type="submit" className={ghostButtonClass}>
                          Save
                        </button>
                        <button
                          type="submit"
                          formAction={moveCall.bind(null, dashboardSlug, "up")}
                          disabled={index === 0}
                          className={`${ghostButtonClass} disabled:opacity-30`}
                        >
                          ↑
                        </button>
                        <button
                          type="submit"
                          formAction={moveCall.bind(null, dashboardSlug, "down")}
                          disabled={index === calls.length - 1}
                          className={`${ghostButtonClass} disabled:opacity-30`}
                        >
                          ↓
                        </button>
                        <DangerButton
                          formAction={deleteCall.bind(null, dashboardSlug)}
                          confirm={`Delete the ${call.title} call?`}
                          className="ml-auto text-[12px] font-semibold text-critical underline-offset-2 hover:underline"
                        >
                          Delete
                        </DangerButton>
                      </div>
                    </form>
                  </details>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {editable && (
        <details className="group border-t border-subtle">
          <summary className="cursor-pointer list-none px-3 py-2 text-[12px] font-semibold text-ink-muted transition-colors hover:text-ink">
            <span className="mr-1 inline-block transition-transform group-open:rotate-90">
              ›
            </span>
            Add a call
          </summary>

          <form
            action={createCall.bind(null, dashboardSlug)}
            className="grid gap-2 px-3 pb-3 sm:grid-cols-2"
          >
            <input
              name="title"
              required
              placeholder="Daily stand-up"
              className={inputClass}
            />
            <input
              name="time"
              placeholder="Every weekday at 9:00am"
              className={inputClass}
            />
            <input
              name="url"
              placeholder="https:// join link"
              className={inputClass}
            />
            <input
              name="notes"
              placeholder="Who runs it, what it covers"
              className={inputClass}
            />
            <div className="sm:col-span-2">
              <button type="submit" className={primaryButtonClass}>
                Add call
              </button>
            </div>
          </form>
        </details>
      )}
    </div>
  );
}
