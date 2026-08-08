"use client";

import { useRef } from "react";

/**
 * A <select> that saves the moment you change it.
 *
 * The board is a thing you glance at and adjust — putting a Save button beside every
 * status, owner and priority would triple the chrome and halve the speed. Changing the
 * value submits the surrounding form, which is a server action.
 *
 * `requestSubmit` rather than `submit` so the form's own validation still runs.
 */
export function AutoSubmitSelect({
  name,
  value,
  options,
  ariaLabel,
  className = "",
  children,
}: {
  name: string;
  value: string;
  options?: { value: string; label: string }[];
  ariaLabel: string;
  className?: string;
  children?: React.ReactNode;
}) {
  const ref = useRef<HTMLSelectElement>(null);

  return (
    <select
      ref={ref}
      name={name}
      defaultValue={value}
      aria-label={ariaLabel}
      onChange={() => ref.current?.form?.requestSubmit()}
      className={className}
    >
      {children ??
        options?.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
    </select>
  );
}
