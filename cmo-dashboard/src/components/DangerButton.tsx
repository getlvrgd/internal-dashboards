"use client";

/**
 * A submit button that asks first.
 *
 * Deletions here are permanent and unbatched — there is no trash and no undo — so the
 * ones that would cost real work to rebuild (a client, a SOP category and everything in
 * it) go through this. Single tasks deliberately do not: losing one line is cheap, and a
 * dialog on every row would train people to dismiss it without reading.
 */
export function DangerButton({
  confirm,
  children,
  className = "",
}: {
  confirm: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="submit"
      onClick={(event) => {
        if (!window.confirm(confirm)) event.preventDefault();
      }}
      className={className}
    >
      {children}
    </button>
  );
}
