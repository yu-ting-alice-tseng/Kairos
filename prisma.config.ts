import "dotenv/config";
import { defineConfig } from "prisma/config";

// prisma.config.ts is used by the Prisma CLI for migrations only.
// The runtime adapter (PrismaLibSql) lives in src/lib/prisma.ts.
// Prisma 7 reads TURSO_AUTH_TOKEN from env automatically for libsql:// URLs.
const url = process.env["DATABASE_URL"] ?? "file:./dev.db";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: { url },
});
