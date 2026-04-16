import path from "node:path"
import { config } from "dotenv"
import { defineConfig } from "prisma/config"

// Load .env.local for local dev (Next.js convention)
config({ path: path.resolve(process.cwd(), ".env.local") })
config() // also load .env as fallback

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Use the direct URL for migrations (bypasses PgBouncer)
    url: process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"],
  },
})
