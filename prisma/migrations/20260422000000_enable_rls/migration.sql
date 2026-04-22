-- Enable Row-Level Security on all public tables.
-- Prisma connects via DATABASE_URL as the postgres superuser, which bypasses
-- RLS automatically. These policies protect against direct Supabase client
-- (anon/authenticated role) queries and satisfy Supabase's security scanner.

-- ─────────────────────────────────────────────────────────────
-- Enable RLS
-- ─────────────────────────────────────────────────────────────

ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Project" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Supplier" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SearchSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SearchResult" ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────
-- User policies
-- ─────────────────────────────────────────────────────────────

CREATE POLICY "users_select_own" ON "User"
  FOR SELECT USING (auth.uid()::text = id);

CREATE POLICY "users_update_own" ON "User"
  FOR UPDATE USING (auth.uid()::text = id);

-- ─────────────────────────────────────────────────────────────
-- Project policies
-- ─────────────────────────────────────────────────────────────

CREATE POLICY "projects_select_own" ON "Project"
  FOR SELECT USING (auth.uid()::text = "userId");

CREATE POLICY "projects_insert_own" ON "Project"
  FOR INSERT WITH CHECK (auth.uid()::text = "userId");

CREATE POLICY "projects_update_own" ON "Project"
  FOR UPDATE USING (auth.uid()::text = "userId");

CREATE POLICY "projects_delete_own" ON "Project"
  FOR DELETE USING (auth.uid()::text = "userId");

-- ─────────────────────────────────────────────────────────────
-- SearchSession policies (access via project ownership)
-- ─────────────────────────────────────────────────────────────

CREATE POLICY "sessions_select_own" ON "SearchSession"
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM "Project" p
      WHERE p.id = "projectId"
        AND auth.uid()::text = p."userId"
    )
  );

CREATE POLICY "sessions_insert_own" ON "SearchSession"
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM "Project" p
      WHERE p.id = "projectId"
        AND auth.uid()::text = p."userId"
    )
  );

CREATE POLICY "sessions_delete_own" ON "SearchSession"
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM "Project" p
      WHERE p.id = "projectId"
        AND auth.uid()::text = p."userId"
    )
  );

-- ─────────────────────────────────────────────────────────────
-- SearchResult policies (access via session → project ownership)
-- ─────────────────────────────────────────────────────────────

CREATE POLICY "results_select_own" ON "SearchResult"
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM "SearchSession" ss
      JOIN "Project" p ON p.id = ss."projectId"
      WHERE ss.id = "sessionId"
        AND auth.uid()::text = p."userId"
    )
  );

CREATE POLICY "results_update_own" ON "SearchResult"
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM "SearchSession" ss
      JOIN "Project" p ON p.id = ss."projectId"
      WHERE ss.id = "sessionId"
        AND auth.uid()::text = p."userId"
    )
  );

CREATE POLICY "results_insert_own" ON "SearchResult"
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM "SearchSession" ss
      JOIN "Project" p ON p.id = ss."projectId"
      WHERE ss.id = "sessionId"
        AND auth.uid()::text = p."userId"
    )
  );

CREATE POLICY "results_delete_own" ON "SearchResult"
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM "SearchSession" ss
      JOIN "Project" p ON p.id = ss."projectId"
      WHERE ss.id = "sessionId"
        AND auth.uid()::text = p."userId"
    )
  );

-- ─────────────────────────────────────────────────────────────
-- Supplier policies
-- Suppliers are not user-owned — all authenticated users can read;
-- writes are handled server-side only (via Prisma/service role).
-- ─────────────────────────────────────────────────────────────

CREATE POLICY "suppliers_select_authenticated" ON "Supplier"
  FOR SELECT USING (auth.role() = 'authenticated');
