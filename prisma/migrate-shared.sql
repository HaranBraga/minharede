-- Migração idempotente das colunas/índices novos do schema compartilhado.
-- Roda ANTES do `prisma db push` pra evitar o falso "data loss warning"
-- (Prisma pede --accept-data-loss quando adiciona UNIQUE, mesmo em coluna
-- nullable nova onde NULL não viola unique — comportamento conservador).
--
-- Aplicado nos 3 fronts (conect-crm, painel-360, minha-rede). É seguro
-- rodar em cada deploy: usa IF NOT EXISTS / DO $$ BEGIN.

ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "publicSlug" TEXT;
ALTER TABLE "User"    ADD COLUMN IF NOT EXISTS "contactId"  TEXT;

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
