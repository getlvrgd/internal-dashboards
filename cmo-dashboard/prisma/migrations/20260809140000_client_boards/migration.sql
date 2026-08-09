-- Client boards.
--
-- A client stops being a profile page and becomes a board of its own: progress, the
-- to-do list, its calls, its asset directory and its logins, all on one page. Assets are
-- per offer — the deck, the VSL, the ad account — so they live on the client, while SOPs
-- stay general on the dashboard.
--
-- Additive only. Every column is nullable, and a client with no stored layout reads as
-- the default arrangement; see parseBoardLayout() in src/lib/board.ts.

ALTER TABLE "Client" ADD COLUMN "assetsContent" JSONB;
ALTER TABLE "Client" ADD COLUMN "boardLayout" JSONB;

-- A call can now belong to one offer rather than the whole dashboard. Null keeps the
-- existing behaviour, so every call already stored stays on the dashboard board.
ALTER TABLE "Call" ADD COLUMN "clientId" TEXT;

CREATE INDEX "Call_clientId_idx" ON "Call"("clientId");

ALTER TABLE "Call" ADD CONSTRAINT "Call_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
