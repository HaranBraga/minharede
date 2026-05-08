-- Migração idempotente das colunas/tabelas novas do schema compartilhado.
-- Roda ANTES do `prisma db push` pra evitar o falso "data loss warning"
-- (Prisma é conservador ao adicionar UNIQUE em coluna nullable nova).

-- Colunas novas em Contact e User
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "publicSlug"     TEXT;
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "lgpdConsentAt"  TIMESTAMP(3);
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "lgpdIpAddress"  TEXT;
ALTER TABLE "User"    ADD COLUMN IF NOT EXISTS "contactId"      TEXT;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'Contact_publicSlug_key') THEN
    CREATE UNIQUE INDEX "Contact_publicSlug_key" ON "Contact"("publicSlug");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'User_contactId_key') THEN
    CREATE UNIQUE INDEX "User_contactId_key" ON "User"("contactId");
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'User_contactId_fkey' AND table_name = 'User'
  ) THEN
    ALTER TABLE "User" ADD CONSTRAINT "User_contactId_fkey"
      FOREIGN KEY ("contactId") REFERENCES "Contact"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Tabela RedeLoginLog (legacy, mantida pra compat — não usamos mais)
CREATE TABLE IF NOT EXISTS "RedeLoginLog" (
  "id"        TEXT NOT NULL PRIMARY KEY,
  "type"      TEXT NOT NULL,
  "contactId" TEXT,
  "actorName" TEXT NOT NULL,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "RedeLoginLog_contactId_createdAt_idx" ON "RedeLoginLog"("contactId", "createdAt");
CREATE INDEX IF NOT EXISTS "RedeLoginLog_createdAt_idx"            ON "RedeLoginLog"("createdAt");
CREATE INDEX IF NOT EXISTS "RedeLoginLog_type_createdAt_idx"       ON "RedeLoginLog"("type", "createdAt");

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'RedeLoginLog_contactId_fkey' AND table_name = 'RedeLoginLog'
  ) THEN
    ALTER TABLE "RedeLoginLog" ADD CONSTRAINT "RedeLoginLog_contactId_fkey"
      FOREIGN KEY ("contactId") REFERENCES "Contact"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Tabela RedeUser (login + senha pro minha-rede, separado do User do CRM)
CREATE TABLE IF NOT EXISTS "RedeUser" (
  "id"        TEXT NOT NULL PRIMARY KEY,
  "contactId" TEXT NOT NULL,
  "username"  TEXT NOT NULL,
  "password"  TEXT NOT NULL,
  "active"    BOOLEAN NOT NULL DEFAULT TRUE,
  "lastLogin" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'RedeUser_contactId_key') THEN
    CREATE UNIQUE INDEX "RedeUser_contactId_key" ON "RedeUser"("contactId");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'RedeUser_username_key') THEN
    CREATE UNIQUE INDEX "RedeUser_username_key" ON "RedeUser"("username");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'RedeUser_username_idx') THEN
    CREATE INDEX "RedeUser_username_idx" ON "RedeUser"("username");
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'RedeUser_contactId_fkey' AND table_name = 'RedeUser'
  ) THEN
    ALTER TABLE "RedeUser" ADD CONSTRAINT "RedeUser_contactId_fkey"
      FOREIGN KEY ("contactId") REFERENCES "Contact"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
