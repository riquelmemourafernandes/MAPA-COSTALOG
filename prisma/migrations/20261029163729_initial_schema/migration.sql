-- Initial schema for MAPA COSTALOG (homologation bootstrap).
-- Source of truth: prisma/schema.prisma
-- RLS is enabled and public API roles cannot access these application tables directly;
-- the API connects through the backend's private PostgreSQL connection.

CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'SUPERVISOR', 'OPERACAO', 'CONSULTA');

CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'CONSULTA',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "mapa_rows" (
    "id" TEXT NOT NULL,
    "sequence" SERIAL NOT NULL,
    "operational_key" TEXT,
    "data" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "status" VARCHAR(120),
    "client_name" VARCHAR(255),
    "container" VARCHAR(32),
    "cte" VARCHAR(80),
    "collection_date" TIMESTAMP(3),
    "delivery_date" TIMESTAMP(3),
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by_id" TEXT,
    CONSTRAINT "mapa_rows_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "mapa_columns" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "data_type" TEXT NOT NULL DEFAULT 'text',
    "required" BOOLEAN NOT NULL DEFAULT false,
    "editable" BOOLEAN NOT NULL DEFAULT true,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "group_name" TEXT,
    "help_text" TEXT,
    "config" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "mapa_columns_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "lookup_values" (
    "id" TEXT NOT NULL,
    "list_name" TEXT NOT NULL,
    "code" TEXT,
    "label" TEXT NOT NULL,
    "normalized" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "lookup_values_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "field_key" TEXT,
    "before_value" JSONB,
    "after_value" JSONB,
    "reason" TEXT,
    "user_id" TEXT,
    "mapa_row_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "formula_rules" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "expression" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "test_cases" JSONB NOT NULL DEFAULT '[]'::jsonb,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "formula_rules_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "mapa_rows_sequence_key" ON "mapa_rows"("sequence");
CREATE INDEX "mapa_rows_status_idx" ON "mapa_rows"("status");
CREATE INDEX "mapa_rows_client_name_idx" ON "mapa_rows"("client_name");
CREATE INDEX "mapa_rows_container_idx" ON "mapa_rows"("container");
CREATE INDEX "mapa_rows_cte_idx" ON "mapa_rows"("cte");
CREATE INDEX "mapa_rows_collection_date_idx" ON "mapa_rows"("collection_date");
CREATE INDEX "mapa_rows_delivery_date_idx" ON "mapa_rows"("delivery_date");
CREATE INDEX "mapa_rows_updated_at_idx" ON "mapa_rows"("updated_at");
CREATE UNIQUE INDEX "mapa_columns_key_key" ON "mapa_columns"("key");
CREATE INDEX "mapa_columns_position_idx" ON "mapa_columns"("position");
CREATE UNIQUE INDEX "lookup_values_list_name_normalized_key" ON "lookup_values"("list_name", "normalized");
CREATE INDEX "lookup_values_list_name_active_idx" ON "lookup_values"("list_name", "active");
CREATE INDEX "audit_logs_entity_type_entity_id_created_at_idx" ON "audit_logs"("entity_type", "entity_id", "created_at");
CREATE INDEX "audit_logs_mapa_row_id_created_at_idx" ON "audit_logs"("mapa_row_id", "created_at");
CREATE INDEX "audit_logs_user_id_created_at_idx" ON "audit_logs"("user_id", "created_at");
CREATE UNIQUE INDEX "formula_rules_key_key" ON "formula_rules"("key");

ALTER TABLE "audit_logs"
    ADD CONSTRAINT "audit_logs_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "audit_logs"
    ADD CONSTRAINT "audit_logs_mapa_row_id_fkey"
    FOREIGN KEY ("mapa_row_id") REFERENCES "mapa_rows"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Defense in depth for Supabase's exposed public schema. The server uses its private DB connection.
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "mapa_rows" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "mapa_columns" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "lookup_values" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "formula_rules" ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE "users", "mapa_rows", "mapa_columns", "lookup_values", "audit_logs", "formula_rules" FROM anon, authenticated;
