/**
 * Custom migration runner for Turso (libsql).
 * Reads SQL files from prisma/migrations/ and applies any that haven't run yet.
 * Tracks applied migrations in a _migrations table on the database itself.
 */
import { createClient } from '@libsql/client'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

const url = process.env.DATABASE_URL
const authToken = process.env.TURSO_AUTH_TOKEN

if (!url) {
  console.log('No DATABASE_URL — skipping migrations (local build without DB).')
  process.exit(0)
}

const client = createClient({ url, ...(authToken ? { authToken } : {}) })

// Ensure migrations tracking table exists
await client.execute(`
  CREATE TABLE IF NOT EXISTS _migrations (
    id    INTEGER PRIMARY KEY AUTOINCREMENT,
    name  TEXT NOT NULL UNIQUE,
    ran_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`)

// Find applied migrations
const { rows } = await client.execute('SELECT name FROM _migrations')
const applied = new Set(rows.map((r) => String(r.name)))

// Collect migration directories, sorted by name (timestamp prefix keeps order)
const migrationsDir = join(process.cwd(), 'prisma', 'migrations')
const dirs = readdirSync(migrationsDir)
  .filter((d) => statSync(join(migrationsDir, d)).isDirectory())
  .sort()

let ran = 0
for (const dir of dirs) {
  if (applied.has(dir)) continue
  const sqlPath = join(migrationsDir, dir, 'migration.sql')
  let sql
  try {
    sql = readFileSync(sqlPath, 'utf-8')
  } catch {
    continue // no migration.sql in this dir (e.g. desktop.ini folders)
  }

  console.log(`Applying migration: ${dir}`)
  // Strip comment lines first, then split on semicolons
  const cleanSql = sql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')
  const statements = cleanSql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)

  if (statements.length === 0) {
    console.log(`  (no statements — skipping)`)
    continue
  }

  for (const stmt of statements) {
    await client.execute(stmt)
  }

  await client.execute({
    sql: 'INSERT INTO _migrations (name) VALUES (?)',
    args: [dir],
  })
  ran++
}

console.log(ran > 0 ? `✓ Applied ${ran} migration(s).` : '✓ Database already up to date.')
