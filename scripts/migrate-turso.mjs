import { createClient } from '@libsql/client'

const url       = process.env.DATABASE_URL
const authToken = process.env.TURSO_AUTH_TOKEN

if (!url || !authToken) {
  console.error('❌  Set DATABASE_URL and TURSO_AUTH_TOKEN before running this script.')
  process.exit(1)
}

const client = createClient({ url, authToken })

const statements = [
  `CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" DATETIME,
    "image" TEXT,
    "language" TEXT NOT NULL DEFAULT 'fr',
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Paris',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "Account" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" DATETIME NOT NULL,
    FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" DATETIME NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "CalendarAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#4F46E5',
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "expiresAt" DATETIME,
    "calendarId" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "Task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "calendarAccountId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "importance" INTEGER NOT NULL DEFAULT 5,
    "urgency" INTEGER NOT NULL DEFAULT 5,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "estimatedMinutes" INTEGER,
    "actualMinutes" INTEGER,
    "scheduledStart" DATETIME,
    "scheduledEnd" DATETIME,
    "deadline" DATETIME,
    "completedAt" DATETIME,
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "parentTaskId" TEXT,
    "calendarEventId" TEXT,
    "tags" TEXT,
    "notes" TEXT,
    "aiSuggested" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY ("calendarAccountId") REFERENCES "CalendarAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    FOREIGN KEY ("parentTaskId") REFERENCES "Task" ("id") ON DELETE SET NULL ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "Habit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT NOT NULL DEFAULT '#10B981',
    "icon" TEXT,
    "frequency" TEXT NOT NULL DEFAULT 'DAILY',
    "targetDays" TEXT,
    "scheduledTime" TEXT,
    "durationMinutes" INTEGER,
    "calendarEventId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "streak" INTEGER NOT NULL DEFAULT 0,
    "longestStreak" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "HabitCompletion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "habitId" TEXT NOT NULL,
    "completedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    FOREIGN KEY ("habitId") REFERENCES "Habit" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "DailyRecap" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "summary" TEXT NOT NULL,
    "tasksTotal" INTEGER NOT NULL DEFAULT 0,
    "tasksDone" INTEGER NOT NULL DEFAULT 0,
    "tasksMissed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "SubCalendar" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "calendarAccountId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#4F46E5',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    FOREIGN KEY ("calendarAccountId") REFERENCES "CalendarAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "SubCalendar_calendarAccountId_externalId_key" ON "SubCalendar"("calendarAccountId", "externalId")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Session_sessionToken_key" ON "Session"("sessionToken")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "VerificationToken_token_key" ON "VerificationToken"("token")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token")`,
]

console.log(`🔌  Connecting to ${url}\n`)

for (const sql of statements) {
  const name = sql.match(/(TABLE|INDEX) IF NOT EXISTS "?(\w+)"?/)?.[2] ?? '?'
  try {
    await client.execute(sql)
    console.log(`✅  ${name}`)
  } catch (err) {
    console.error(`❌  ${name}: ${err.message}`)
  }
}

console.log('\n🎉  Done — all tables created in Turso.')
