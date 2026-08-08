import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "node:crypto";

/**
 * Encryption for the login vault.
 *
 * The Notion board this replaces kept every password as plain text in a table, which
 * meant anyone who reached the page — or any integration with read access to it — had
 * the lot. Here the password is sealed before it is written, so a leaked database dump
 * is not a leaked credential set.
 *
 * AES-256-GCM: authenticated, so a tampered ciphertext fails to open rather than
 * decrypting to rubbish. The stored payload is `iv:tag:ciphertext`, base64 each.
 *
 * What this does and does not buy you:
 *
 *   * It protects against the database being read — a dump, a stray backup, a Neon
 *     console, an over-broad read replica.
 *   * It does NOT protect against someone who can run this code, since the key is in
 *     the environment beside it. That is what the role check on the reveal action is
 *     for, and why revealing is a deliberate per-credential act.
 *
 * The key is derived from CREDENTIAL_KEY with scrypt so the env var can be any length
 * of text, not exactly 32 bytes.
 */

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12; // 96 bits, the size GCM is specified around.

/**
 * A fixed salt. It is not doing the job a password salt does — the input here is a
 * high-entropy secret rather than something a person chose — and it has to be constant
 * or the same key would derive differently on every boot and nothing would open.
 */
const SALT = "cmo-dashboard/credential-key/v1";

let cached: Buffer | null = null;

function key() {
  if (cached) return cached;
  const raw = process.env.CREDENTIAL_KEY;
  if (!raw || raw.length < 32) {
    throw new Error(
      "CREDENTIAL_KEY is missing or shorter than 32 characters. Set it in .env — " +
        "the login vault cannot be read or written without it.",
    );
  }
  cached = scryptSync(raw, SALT, 32);
  return cached;
}

/** True when the vault is usable. Lets the UI explain itself instead of throwing. */
export function vaultConfigured() {
  const raw = process.env.CREDENTIAL_KEY;
  return Boolean(raw && raw.length >= 32);
}

export function seal(plain: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key(), iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    iv.toString("base64"),
    tag.toString("base64"),
    body.toString("base64"),
  ].join(":");
}

/**
 * Opens a sealed payload. Returns null rather than throwing when the value cannot be
 * read — a row written under a previous CREDENTIAL_KEY should show as unreadable in the
 * UI, not take the page down with it.
 */
export function open(payload: string | null): string | null {
  if (!payload) return null;
  const parts = payload.split(":");
  if (parts.length !== 3) return null;

  try {
    const [iv, tag, body] = parts.map((p) => Buffer.from(p, "base64"));
    const decipher = createDecipheriv(ALGORITHM, key(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([
      decipher.update(body),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}
