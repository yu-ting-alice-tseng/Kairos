-- AlterTable
-- NULL means "never saved": the page then uploads the list it kept in the browser.
ALTER TABLE "User" ADD COLUMN "reminderPatterns" TEXT;
