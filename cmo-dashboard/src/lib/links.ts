import type { Prisma } from "@/generated/prisma/client";

export type QuickLink = { label: string; url: string };

/**
 * Reads the `links` JSON column back into something renderable.
 *
 * The column is `Json`, so as far as the type system is concerned it could be anything —
 * and for a row written by an older version of the form, it might be. Everything that is
 * not a `{ label, url }` pair is dropped rather than trusted, since these values end up
 * in an `href`.
 */
export function readQuickLinks(value: Prisma.JsonValue | null): QuickLink[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry) => {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      return [];
    }
    const record = entry as Record<string, unknown>;
    const label = typeof record.label === "string" ? record.label.trim() : "";
    const url = typeof record.url === "string" ? record.url.trim() : "";
    if (label === "" && url === "") return [];
    return [{ label: label || url, url }];
  });
}

/**
 * Makes a stored link safe to put in an href.
 *
 * Only http and https survive. A `javascript:` URL typed into the link field would
 * otherwise be a stored cross-site scripting hole that every teammate clicks — and a
 * bare "acme.com", which is what people actually type, is promoted to https rather than
 * being treated as a relative path.
 */
export function safeHref(url: string): string | null {
  const trimmed = url.trim();
  if (trimmed === "") return null;

  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}
