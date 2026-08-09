/**
 * Money in, money out.
 *
 * Everything is stored and passed around as integer cents. A float never touches an
 * amount: 0.1 + 0.2 is not 0.3, and a revenue total that is a penny out is a revenue
 * total nobody trusts.
 */

/**
 * Reads what someone typed into an amount field.
 *
 * Accepts "1200", "1,200", "$1,200.50", " 1200 " — people paste from invoices and
 * spreadsheets, and rejecting a comma teaches them to distrust the field. Returns null
 * for anything that is not a positive amount.
 */
export function parseAmountToCents(input: string): number | null {
  const cleaned = input.replace(/[$£€,\s]/g, "");
  if (!cleaned || !/^\d*\.?\d*$/.test(cleaned)) return null;

  const value = Number(cleaned);
  if (!Number.isFinite(value) || value <= 0) return null;

  // Rounded rather than truncated, so 10.005 does not silently become 10.00.
  const cents = Math.round(value * 100);
  // A sanity ceiling: beyond this it is a typo, not a payment.
  if (cents > 1_000_000_000_00) return null;
  return cents;
}

/** `$10,000` — whole dollars unless there are cents to show. */
export function formatCents(cents: number, currency = "USD"): string {
  const hasCents = cents % 100 !== 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: hasCents ? 2 : 0,
  }).format(cents / 100);
}

/** `$10k`, for axis labels and tight spaces. */
export function formatCentsShort(cents: number): string {
  const value = cents / 100;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}m`;
  if (value >= 1_000) return `$${Math.round(value / 1_000)}k`;
  return `$${Math.round(value)}`;
}

/** UTC midnight of the day `date` falls in — how a day's takings are bucketed. */
export function startOfDayUTC(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

export function startOfMonthUTC(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

export function daysInMonthUTC(date: Date): number {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
  ).getUTCDate();
}
