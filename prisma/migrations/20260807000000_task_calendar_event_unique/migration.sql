-- Collapse tasks that already point at the same calendar event, then make the
-- pairing unique so concurrent syncs can never create a second copy again.
-- Kept row per (userId, calendarEventId): the one the user has configured
-- (importance/urgency moved off the 5/5 default), otherwise the oldest.

-- Children of the rows about to disappear are detached, not deleted.
UPDATE "Task" SET "parentTaskId" = NULL WHERE "parentTaskId" IN (
  SELECT "id" FROM (
    SELECT "id", ROW_NUMBER() OVER (
      PARTITION BY "userId", "calendarEventId"
      ORDER BY (CASE WHEN "importance" <> 5 OR "urgency" <> 5 THEN 0 ELSE 1 END), "createdAt", "rowid"
    ) AS rn
    FROM "Task" WHERE "calendarEventId" IS NOT NULL
  ) WHERE rn > 1
);

DELETE FROM "Task" WHERE "id" IN (
  SELECT "id" FROM (
    SELECT "id", ROW_NUMBER() OVER (
      PARTITION BY "userId", "calendarEventId"
      ORDER BY (CASE WHEN "importance" <> 5 OR "urgency" <> 5 THEN 0 ELSE 1 END), "createdAt", "rowid"
    ) AS rn
    FROM "Task" WHERE "calendarEventId" IS NOT NULL
  ) WHERE rn > 1
);

CREATE UNIQUE INDEX "Task_userId_calendarEventId_key" ON "Task"("userId", "calendarEventId");
