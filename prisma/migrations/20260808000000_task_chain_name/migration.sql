-- Optional name for a task chain, stored on the task that heads it.
ALTER TABLE "Task" ADD COLUMN "chainName" TEXT;
