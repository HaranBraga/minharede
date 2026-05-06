FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npx prisma generate
RUN npm run build

# ── Runner ──────────────────────────────────────────────
FROM node:20-alpine AS runner
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts

EXPOSE 3000

# Sincroniza schema (sem --accept-data-loss; ver schema do conect-crm).
# O schema é compartilhado — se o CRM já estiver com tudo, o db push aqui
# é no-op. Se o minha-rede subir antes, ele cria as tabelas.
CMD ["sh", "-c", "npx prisma db push && node scripts/startup.js && npm start"]
