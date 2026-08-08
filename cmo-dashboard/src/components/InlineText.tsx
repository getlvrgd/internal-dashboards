"use client";

import { useRef } from "react";

/**
 * A text field that looks like plain text until you touch it, and saves when you leave.
 *
 * Editing a task title should not mean opening a dialog. This keeps the row reading as a
 * line of text — no border, no fill — and only submits when the value actually changed,
 * so tabbing across a board does not fire a write per row.
 *
 * Enter commits and Escape puts the original value back, which is what a field that
 * saves on blur has to offer if it is not going to trap a mistake.
 */
export function InlineText({
  name,
  defaultValue,
  ariaLabel,
  placeholder,
  className = "",
}: {
  name: string;
  defaultValue: string;
  ariaLabel: string;
  placeholder?: string;
  className?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const committed = useRef(defaultValue);

  const commit = () => {
    const input = ref.current;
    if (!input) return;
    const value = input.value.trim();
    if (value === "" ) {
      // A title is required; an emptied field returns to what it was rather than
      // saving a blank row the server would reject anyway.
      input.value = committed.current;
      return;
    }
    if (value === committed.current) return;
    committed.current = value;
    input.form?.requestSubmit();
  };

  return (
    <input
      ref={ref}
      name={name}
      defaultValue={defaultValue}
      aria-label={ariaLabel}
      placeholder={placeholder}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          ref.current?.blur();
        }
        if (event.key === "Escape") {
          event.preventDefault();
          if (ref.current) ref.current.value = committed.current;
          ref.current?.blur();
        }
      }}
      className={`w-full min-w-0 rounded-md border border-transparent bg-transparent px-1.5 py-1 outline-none hover:border-subtle focus:border-accent focus:bg-surface ${className}`}
    />
  );
}
