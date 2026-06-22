import { NextResponse } from 'next/server'

// Safe env check — shows whether vars are set, never their values
export async function GET() {
  const check = (key: string) => {
    const val = process.env[key]
    if (!val) return '❌ missing'
    if (val.length < 5) return '⚠️ too short'
    return `✅ set (${val.length} chars)`
  }

  return NextResponse.json({
    auth: {
      AUTH_SECRET: check('AUTH_SECRET'),
      AUTH_URL: process.env.AUTH_URL ?? '❌ missing',
    },
    google: {
      GOOGLE_CLIENT_ID: check('GOOGLE_CLIENT_ID'),
      GOOGLE_CLIENT_SECRET: check('GOOGLE_CLIENT_SECRET'),
    },
    notion: {
      NOTION_CLIENT_ID: check('NOTION_CLIENT_ID'),
      NOTION_CLIENT_SECRET: check('NOTION_CLIENT_SECRET'),
    },
    database: {
      DATABASE_URL: check('DATABASE_URL'),
      TURSO_AUTH_TOKEN: check('TURSO_AUTH_TOKEN'),
    },
  })
}
