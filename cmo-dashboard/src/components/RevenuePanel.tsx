"use client";

import { useActionState } from "react";

import {
  addPayment,
  deletePayment,
  setRevenueGoal,
  type RevenueState,
} from "@/app/actions/revenue";
import { formatCents, formatCentsShort } from "@/lib/money";

import { inputClass } from "./ui";

export type PaymentRow = {
  id: string;
  amountCents: number;
  note: string | null;
  clientName: string | null;
  receivedAt: string;
};

/**
 * Money in today, against the day's target.
 *
 * Logged by hand for now — the intention is that payments arrive attributed to a client
 * automatically, and the rows written here already carry that field so nothing needs
 * backfilling when it lands.
 *
 * The ring is a percentage of the daily goal; with no goal set it is dropped entirely
 * rather than showing a percentage of nothing. The strip along the bottom is the month
 * so far, which is what turns one good day into a trend you can see.
 */
export function RevenuePanel({
  dashboardSlug,
  todayCents,
  goalCents,
  monthDays,
  monthLabel,
  payments,
  clients,
  editable,
}: {
  dashboardSlug: string;
  todayCents: number;
  goalCents: number;
  /** One entry per day of the current month, in cents. */
  monthDays: number[];
  monthLabel: string;
  payments: PaymentRow[];
  clients: { id: string; name: string }[];
  editable: boolean;
}) {
  const [state, action, pending] = useActionState<RevenueState, FormData>(
    addPayment.bind(null, dashboardSlug),
    {},
  );

  const pct =
    goalCents > 0 ? Math.min(100, Math.round((todayCents / goalCents) * 100)) : null;
  const remaining = Math.max(0, goalCents - todayCents);

  return (
    <div className="rounded-xl border border-subtle bg-surface p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        {pct !== null && <Ring pct={pct} />}

        <div className="min-w-0 flex-1">
          {editable && (
            <form action={action} className="flex flex-wrap items-end gap-2">
              <label className="min-w-0 flex-1">
                <span className="text-[10px] font-bold tracking-widest text-ink-muted uppercase">
                  Add a payment
                </span>
                <input
                  name="amount"
                  required
                  inputMode="decimal"
                  placeholder="$ 0"
                  aria-label="Amount"
                  className={`${inputClass} mt-1 w-full`}
                />
              </label>

              {clients.length > 0 && (
                <select
                  name="clientId"
                  defaultValue=""
                  aria-label="Client"
                  className={`${inputClass} w-32 shrink-0`}
                >
                  <option value="">No client</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              )}

              <button
                type="submit"
                disabled={pending}
                className="shrink-0 rounded-lg px-4 py-1.5 text-[13px] font-bold text-page"
                style={{ background: "var(--status-good)" }}
              >
                {pending ? "…" : "add"}
              </button>
            </form>
          )}

          {state.error && (
            <p
              role="alert"
              className="mt-1.5 text-[12px]"
              style={{ color: "var(--status-critical)" }}
            >
              {state.error}
            </p>
          )}

          {editable && (
            <form action={setRevenueGoal.bind(null, dashboardSlug)} className="mt-2.5">
              <label className="block">
                <span className="text-[10px] font-bold tracking-widest text-ink-muted uppercase">
                  Daily goal
                </span>
                <input
                  name="goal"
                  defaultValue={goalCents > 0 ? String(goalCents / 100) : ""}
                  inputMode="decimal"
                  placeholder="$ 10000"
                  aria-label="Daily goal"
                  onBlur={(e) => e.currentTarget.form?.requestSubmit()}
                  className={`${inputClass} mt-1 w-full`}
                />
              </label>
            </form>
          )}

          <p className="mt-3 text-[15px] font-bold">
            made{" "}
            <span style={{ color: "var(--status-good)" }}>
              {formatCents(todayCents)}
            </span>{" "}
            today
            {goalCents > 0 && (
              <span className="ml-2 text-[12.5px] font-semibold text-ink-muted">
                {remaining > 0
                  ? `${formatCents(remaining)} to goal`
                  : "goal cleared"}
              </span>
            )}
          </p>
        </div>
      </div>

      {payments.length === 0 ? (
        <p className="mt-3 text-[12.5px] text-ink-muted italic">
          No payments logged yet today — add them as they land.
        </p>
      ) : (
        <ul className="mt-3 space-y-1">
          {payments.map((payment) => (
            <li
              key={payment.id}
              className="flex items-center gap-2 text-[12.5px]"
            >
              <span className="font-semibold tabular-nums">
                {formatCents(payment.amountCents)}
              </span>
              <span className="min-w-0 flex-1 truncate text-ink-muted">
                {[payment.clientName, payment.note].filter(Boolean).join(" · ")}
              </span>
              {editable && (
                <form action={deletePayment.bind(null, dashboardSlug)}>
                  <input type="hidden" name="id" value={payment.id} />
                  <button
                    aria-label="Remove payment"
                    className="text-ink-muted transition-colors hover:text-critical"
                  >
                    ✕
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}

      <MonthStrip
        days={monthDays}
        goalCents={goalCents}
        label={monthLabel}
      />
    </div>
  );
}

/** The dial. A ring rather than a bar because it sits beside a number, not under one. */
function Ring({ pct }: { pct: number }) {
  const size = 92;
  const stroke = 9;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="shrink-0" style={{ width: size, height: size }}>
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="size-full -rotate-90"
        role="img"
        aria-label={`${pct}% of the daily goal`}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--border-subtle)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--status-good)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - pct / 100)}
          className="transition-[stroke-dashoffset] duration-700"
        />
      </svg>
      <div className="-mt-[62px] text-center">
        <div className="text-[19px] font-bold tabular-nums">{pct}%</div>
        <div className="text-[10px] text-ink-muted">of goal</div>
      </div>
    </div>
  );
}

/**
 * The month so far, one bar per day.
 *
 * Bars rather than a line: a day with nothing in it should read as an empty slot, and a
 * line drawn through zeros implies a continuity that daily takings do not have.
 */
function MonthStrip({
  days,
  goalCents,
  label,
}: {
  days: number[];
  goalCents: number;
  label: string;
}) {
  const peak = Math.max(goalCents, ...days, 1);

  return (
    <div className="mt-4 border-t border-subtle pt-3">
      <div className="flex items-baseline justify-between text-[11px]">
        <span className="font-semibold">{label}</span>
        {goalCents > 0 && (
          <span className="text-ink-muted">
            Goal: {formatCentsShort(goalCents)}/day
          </span>
        )}
      </div>

      <div className="relative mt-2 h-16">
        {goalCents > 0 && (
          <div
            aria-hidden
            className="absolute inset-x-0 border-t border-dashed border-strong"
            style={{ bottom: `${(goalCents / peak) * 100}%` }}
          />
        )}
        <div className="flex h-full items-end gap-px">
          {days.map((cents, i) => (
            <div
              key={i}
              title={`Day ${i + 1}: ${formatCents(cents)}`}
              className="flex-1 rounded-t-[2px]"
              style={{
                height: cents > 0 ? `${Math.max(3, (cents / peak) * 100)}%` : "2px",
                background:
                  cents > 0 ? "var(--series-1)" : "var(--border-subtle)",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
