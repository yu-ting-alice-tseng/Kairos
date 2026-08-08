-- Which sub-calendar an event-backed task came from. Existing rows stay NULL
-- until the next sync sees their event again and fills it in.
ALTER TABLE "Task" ADD COLUMN "calendarId" TEXT;
