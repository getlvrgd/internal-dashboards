-- Board panels, revenue and standing calls.
--
-- The board stops being a fixed page: `boardLayout` holds which panels a dashboard
-- shows, in what order, under what heading. Revenue and calls are new tables.
--
-- Additive only. Every column added is either nullable or has a default, and no
-- existing row is touched — a dashboard with no boardLayout reads as the default
-- arrangement, which is what parseBoardLayout() in src/lib/board.ts is for.

ALTER TABLE "Dashboard" ADD COLUMN "boardLayout" JSONB;
ALTER TABLE "Dashboard" ADD COLUMN "revenueGoalCents" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "dashboardId" TEXT NOT NULL,
    -- Cents, as an integer. No float ever touches money.
    "amountCents" INTEGER NOT NULL,
    "note" TEXT,
    "clientId" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Payment_dashboardId_receivedAt_idx" ON "Payment"("dashboardId", "receivedAt");
CREATE INDEX "Payment_clientId_idx" ON "Payment"("clientId");

ALTER TABLE "Payment" ADD CONSTRAINT "Payment_dashboardId_fkey"
    FOREIGN KEY ("dashboardId") REFERENCES "Dashboard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "Call" (
    "id" TEXT NOT NULL,
    "dashboardId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT,
    "time" TEXT,
    "notes" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Call_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Call_dashboardId_idx" ON "Call"("dashboardId");

ALTER TABLE "Call" ADD CONSTRAINT "Call_dashboardId_fkey"
    FOREIGN KEY ("dashboardId") REFERENCES "Dashboard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
