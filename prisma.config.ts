import "dotenv/config";
import { defineConfig } from "prisma/config";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const url      = process.env["DATABASE_URL"] ?? "file:./dev.db";
const authToken = process.env["TURSO_AUTH_TOKEN"];
const isRemote  = url.startsWith("libsql:") || url.startsWith("https:");

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: isRemote
    ? { adapter: new PrismaLibSql({ url, ...(authToken ? { authToken } : {}) }) }
    : { url },
});
