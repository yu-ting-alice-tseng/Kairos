-- Add importance and urgency to Habit
ALTER TABLE "Habit" ADD COLUMN "importance" INTEGER NOT NULL DEFAULT 5;
ALTER TABLE "Habit" ADD COLUMN "urgency" INTEGER NOT NULL DEFAULT 5;

-- SQLite does not support DROP COLUMN in older versions; we keep calendarEventId/calendarAccountId/calendarId
-- as nullable — they are simply no longer written to and will be ignored.
-- If they don't exist yet (fresh DB), the following are no-ops handled at app level.
