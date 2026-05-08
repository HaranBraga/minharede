// Startup do minha-rede.
//
// Não cria User na tabela compartilhada (regra do user: usuários do
// minha-rede são SEPARADOS dos do CRM/painel-360). Identidade dos
// coords/líderes é o próprio Contact, sem User. Admin do minha-rede
// é a senha em ADMIN_PASSWORD env (sem User).
//
// Aqui só garantimos que os 4 PersonRole essenciais existam, caso
// o minha-rede suba antes do CRM/painel-360.

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const NETWORK_ROLES = [
  { id: "role-coordenador-grupo", key: "COORDENADOR_GRUPO", label: "Coordenador de Grupo", color: "#7c3aed", bgColor: "#ede9fe", level: 0 },
  { id: "role-coordenador",       key: "COORDENADOR",       label: "Coordenador",          color: "#1d4ed8", bgColor: "#dbeafe", level: 1 },
  { id: "role-lider",             key: "LIDER",             label: "Líder",                color: "#b45309", bgColor: "#fef3c7", level: 2 },
  { id: "role-apoiador",          key: "APOIADOR",          label: "Apoiador",             color: "#15803d", bgColor: "#dcfce7", level: 3 },
];

async function ensureRoles() {
  for (const role of NETWORK_ROLES) {
    await prisma.personRole.upsert({
      where: { id: role.id },
      update: {},
      create: role,
    });
  }
  console.log("✅ Cargos da rede verificados");
}

async function main() {
  await ensureRoles();
}

main()
  .catch((e) => { console.error("Startup error:", e); })
  .finally(() => prisma.$disconnect());
