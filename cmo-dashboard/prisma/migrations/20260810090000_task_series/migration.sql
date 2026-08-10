-- Standing tasks get a series identity.
--
-- ensureWeek() used to clone forward from the immediately previous week only, and gave
-- up if the week already held any task at all. So a week nobody opened broke the chain
-- permanently, and adding a single one-off to a week stopped its routine ever appearing.
-- Both looked like "my weekly task disappeared".
--
-- With a series id, a week can ask "which standing tasks am I missing?" against the most
-- recent instance of each series, however long ago that was.

ALTER TABLE "Task" ADD COLUMN "seriesId" TEXT;

CREATE INDEX "Task_dashboardId_seriesId_idx" ON "Task"("dashboardId", "seriesId");

-- Everything already marked weekly becomes the first instance of its own series, so
-- existing routines keep running instead of starting over.
UPDATE "Task" SET "seriesId" = "id" WHERE "recurring" = true AND "seriesId" IS NULL;
