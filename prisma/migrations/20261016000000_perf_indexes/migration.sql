-- Lookups that ran as full table scans on every page load: the subtask join
-- (Task.parentTaskId), today's habit completions (HabitCompletion.habitId) and
-- the habit list itself (Habit.userId).
CREATE INDEX IF NOT EXISTS "Task_parentTaskId_idx" ON "Task"("parentTaskId");
CREATE INDEX IF NOT EXISTS "HabitCompletion_habitId_completedAt_idx" ON "HabitCompletion"("habitId", "completedAt");
CREATE INDEX IF NOT EXISTS "Habit_userId_idx" ON "Habit"("userId");
