"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import { revealSecret } from "@/app/actions/credentials";

const HIDE_AFTER_MS = 30_000;

/**
 * The password cell in the vault.
 *
 * The value is not in the page until it is asked for: the list renders from rows that
 * were never decrypted, and clicking Reveal fetches this one password on its own. That
 * keeps a screen-share or a screenshot of the vault from being a leak of everything in
 * it, which is exactly what the Notion table this replaces was.
 *
 * A revealed value hides itself again after thirty seconds, because the realistic
 * failure here is a tab left open on a desk, not an attacker.
 */
export function SecretField({
  id,
  hasSecret,
}: {
  id: string;
  hasSecret: boolean;
}) {
  const [value, setValue] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clears the countdown if the row unmounts while a value is showing, so a revealed
  // password cannot be re-hidden into a component that is no longer there.
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  if (!hasSecret) {
    return <span className="text-[12px] text-ink-muted">No password saved</span>;
  }

  const hide = () => {
    if (timer.current) clearTimeout(timer.current);
    setValue(null);
    setCopied(false);
  };

  const reveal = () => {
    setError(null);
    startTransition(async () => {
      const result = await revealSecret(id);
      if (result.error) {
        setError(result.error);
        return;
      }
      setValue(result.value ?? "");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(hide, HIDE_AFTER_MS);
    });
  };

  const copy = async () => {
    // Fetched fresh rather than requiring a reveal first — copying to paste into a login
    // box is the common case, and it need never put the value on screen at all.
    const text = value ?? (await revealSecret(id)).value;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be refused (insecure origin, permissions). Falling back to
      // showing the value is more useful than a silent no-op.
      setValue(text);
    }
  };

  return (
    <span className="flex items-center gap-2">
      <code className="min-w-0 flex-1 truncate rounded-md bg-page px-1.5 py-0.5 font-mono text-[12px]">
        {value ?? "••••••••••"}
      </code>

      <button
        type="button"
        onClick={value ? hide : reveal}
        disabled={pending}
        className={buttonClass}
      >
        {pending ? "…" : value ? "Hide" : "Reveal"}
      </button>

      <button type="button" onClick={copy} className={buttonClass}>
        {copied ? "Copied" : "Copy"}
      </button>

      {error && (
        <span role="alert" className="text-[12px] text-critical">
          {error}
        </span>
      )}
    </span>
  );
}

const buttonClass =
  "shrink-0 rounded-md border border-subtle px-1.5 py-0.5 text-[12px] font-semibold text-ink-secondary transition-colors hover:border-strong hover:text-ink disabled:opacity-50";
