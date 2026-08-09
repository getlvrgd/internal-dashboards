-- Remembered tools, offered when adding a login.
--
-- Global rather than per dashboard: Gmail is Gmail whichever board you are on. Learned
-- from what gets typed, so the list fills itself instead of needing a seed nobody
-- maintains. Holds only the tool and its URL — never an account or a password.

CREATE TABLE "LoginPreset" (
    "id" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "url" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoginPreset_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LoginPreset_service_key" ON "LoginPreset"("service");
