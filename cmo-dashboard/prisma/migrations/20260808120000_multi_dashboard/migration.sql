-- Multi-dashboard restructure.
--
-- The app used to BE the CMO dashboard; it now hosts many, and the CMO one is a row in
-- "Dashboard". Every workspace table gains a dashboardId, the SOP tables are replaced by
-- a block document on the dashboard, and a login can no longer be company-wide.
--
-- This migration is destructive by design. Client, Task, Kpi and Credential all gain a
-- required foreign key with no sensible value to backfill — there is no dashboard to
-- attribute an existing row to — so the workspace tables are emptied first. That is safe
-- here because the only database this has ever run against had no rows in them: setup
-- was never completed, so nothing was created. Accounts in "User" are NOT touched.

-- The SOP library is a JSON document on Dashboard now. These two tables have no
-- equivalent to migrate into and are dropped outright.
DROP TABLE IF EXISTS "Sop";
DROP TABLE IF EXISTS "SopCategory";

-- Emptied so the NOT NULL foreign keys below can be added. Credential first: it points
-- at Client, and Task points at Client too.
DELETE FROM "Credential";
DELETE FROM "Task";
DELETE FROM "Kpi";
DELETE FROM "Client";

-- CreateTable
CREATE TABLE "Dashboard" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "color" TEXT NOT NULL DEFAULT 'blue',
    "isTemplate" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "sopContent" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dashboard_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Dashboard_slug_key" ON "Dashboard"("slug");
CREATE INDEX "Dashboard_status_idx" ON "Dashboard"("status");

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dashboardId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Membership_userId_dashboardId_key" ON "Membership"("userId", "dashboardId");
CREATE INDEX "Membership_dashboardId_idx" ON "Membership"("dashboardId");

ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_dashboardId_fkey"
    FOREIGN KEY ("dashboardId") REFERENCES "Dashboard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Client: scoped to a dashboard, and its slug is unique per dashboard rather than
-- globally — two dashboards may each run a client called "Acme".
DROP INDEX IF EXISTS "Client_slug_key";
DROP INDEX IF EXISTS "Client_status_idx";

ALTER TABLE "Client" ADD COLUMN "dashboardId" TEXT NOT NULL;

CREATE UNIQUE INDEX "Client_dashboardId_slug_key" ON "Client"("dashboardId", "slug");
CREATE INDEX "Client_dashboardId_status_idx" ON "Client"("dashboardId", "status");

ALTER TABLE "Client" ADD CONSTRAINT "Client_dashboardId_fkey"
    FOREIGN KEY ("dashboardId") REFERENCES "Dashboard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Task
DROP INDEX IF EXISTS "Task_weekOf_day_idx";
DROP INDEX IF EXISTS "Task_status_idx";

ALTER TABLE "Task" ADD COLUMN "dashboardId" TEXT NOT NULL;

CREATE INDEX "Task_dashboardId_weekOf_day_idx" ON "Task"("dashboardId", "weekOf", "day");
CREATE INDEX "Task_dashboardId_status_idx" ON "Task"("dashboardId", "status");

ALTER TABLE "Task" ADD CONSTRAINT "Task_dashboardId_fkey"
    FOREIGN KEY ("dashboardId") REFERENCES "Dashboard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Kpi
ALTER TABLE "Kpi" ADD COLUMN "dashboardId" TEXT NOT NULL;

CREATE INDEX "Kpi_dashboardId_idx" ON "Kpi"("dashboardId");

ALTER TABLE "Kpi" ADD CONSTRAINT "Kpi_dashboardId_fkey"
    FOREIGN KEY ("dashboardId") REFERENCES "Dashboard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Credential: always belongs to a client now. The old nullable clientId is what made a
-- company-wide vault possible; requiring it is what removes that concept from the model
-- rather than only from the UI.
ALTER TABLE "Credential" DROP CONSTRAINT IF EXISTS "Credential_clientId_fkey";
ALTER TABLE "Credential" ALTER COLUMN "clientId" SET NOT NULL;
ALTER TABLE "Credential" ADD CONSTRAINT "Credential_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
