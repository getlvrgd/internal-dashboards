"use client";

import { useEffect, useRef } from "react";

/**
 * A text field that looks like plain text until you touch it, and saves when you leave.
 *
 * Editing a task title should not mean opening a dialog. This keeps the row reading as a
 * line of text — no border, no fill — and only submits when the value actually changed,
 * so tabbing across a board does not fire a write per row.
 *
 * It is a textarea rather than an input because an input cannot wrap: a long task title
 * scrolled sideways out of view and the only way to read it was to click in and arrow
 * across. It auto-grows to fit instead, so the whole title is always on screen.
 *
 * Enter still commits — a task title is one thing, not a paragraph — and Escape puts the
 * original value back, which is what a field that saves on blur has to offer if it is
 * not going to trap a mistake.
 *
 * `onCommit` is how the board uses it: the value goes to the task store, which applies
 * it locally before telling the server. Without a handler it falls back to submitting
 * the surrounding form, which is how the client and SOP forms still use it.
 */
export function InlineText({
  name,
  defaultValue,
  ariaLabel,
  placeholder,
  className = "",
  onCommit,
}: {
  name: string;
  defaultValue: string;
  ariaLabel: string;
  placeholder?: string;
  className?: string;
  onCommit?: (value: string) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const committed = useRef(defaultValue);

  /** Height follows content, so nothing is ever hidden below the fold of the field. */
  const grow = () => {
    const el = ref.current;
    if (!el) return;
    // Reset first: without it the box can only ever get taller, never shorter.
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

  // Once on mount, and again whenever the server sends a different value — a title
  // edited elsewhere would otherwise keep the old height.
  useEffect(() => {
    committed.current = defaultValue;
    if (ref.current) ref.current.value = defaultValue;
    grow();
  }, [defaultValue]);

  const commit = () => {
    const el = ref.current;
    if (!el) return;
    const value = el.value.trim();
    if (value === "") {
      // A title is required; an emptied field returns to what it was rather than
      // saving a blank row the server would reject anyway.
      el.value = committed.current;
      grow();
      return;
    }
    if (value === committed.current) return;
    committed.current = value;
    if (onCommit) onCommit(value);
    else el.form?.requestSubmit();
  };

  return (
    <textarea
      ref={ref}
      name={name}
      rows={1}
      defaultValue={defaultValue}
      aria-label={ariaLabel}
      placeholder={placeholder}
      onInput={grow}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          // A title is a line, not a paragraph, so Enter saves rather than adding one.
          event.preventDefault();
          ref.current?.blur();
        }
        if (event.key === "Escape") {
          event.preventDefault();
          if (ref.current) ref.current.value = committed.current;
          grow();
          ref.current?.blur();
        }
      }}
      className={`w-full min-w-0 resize-none overflow-hidden rounded-md border border-transparent bg-transparent px-1.5 py-1 leading-snug outline-none hover:border-subtle focus:border-accent focus:bg-surface ${className}`}
    />
  );
}
