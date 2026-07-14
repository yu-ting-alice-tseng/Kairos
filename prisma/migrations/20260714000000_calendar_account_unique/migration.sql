-- Add unique constraint to prevent duplicate CalendarAccount rows for same (userId, provider, name)
CREATE UNIQUE INDEX "CalendarAccount_userId_provider_name_key" ON "CalendarAccount"("userId", "provider", "name");
