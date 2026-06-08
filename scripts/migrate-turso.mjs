import { createClient } from '@libsql/client'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

const url = process.env.DATABASE_URL
const authToken = process.env.TURSO_AUTH_TOKEN

if (!url || !authToken) {
  console.error('Missing DATABASE_URL or TURSO_AUTH_TOKEN')
  process.exit(1)
}

const client = createClient({ url, authToken })

const sql = readFileSync(
  join(__dirname, '../prisma/migrations/20260608160731_init/migration.sql'),
  'utf-8'
)

// Split on semicolons, filter empty statements
const statements = sql
  .split(';')
  .map(s => s.trim())
  .filter(s => s.length > 0 && !s.startsWith('--'))

console.log(`Applying ${statements.length} statements to Turso...`)

for (const statement of statements) {
  try {
    await client.execute(statement)
    console.log('✓', statement.slice(0, 60).replace(/\n/g, ' '))
  } catch (err) {
    if (err.message.includes('already exists')) {
      console.log('⚠ Already exists, skipping:', statement.slice(0, 50))
    } else {
      console.error('✗ Error:', err.message)
      console.error('  Statement:', statement.slice(0, 100))
    }
  }
}

console.log('\n✅ Migration complete!')
