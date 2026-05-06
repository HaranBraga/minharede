// Startup do minha-rede.
//
// O schema é compartilhado com conect-crm e painel-360. O seed completo
// (roles, kanban, etiquetas, admin) acontece no startup do conect-crm.
// Aqui só garantimos que os 4 PersonRole essenciais pra rede existam,
// caso o minha-rede suba antes do CRM.

const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
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
  console.log("✅ Cargos da rede verificados (Coordenador de Grupo, Coordenador, Líder, Apoiador)");
}

async function ensureAdmin() {
  const userCount = await prisma.user.count();
  if (userCount > 0) {
    console.log(`✅ Usuários: ${userCount} cadastrados`);
    return;
  }
  const username = (process.env.ADMIN_USERNAME || "admin").toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "admin123";
  const hashed = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: {
      name: "Administrador",
      username,
      password: hashed,
      isAdmin: true,
      modules: [],
      active: true,
    },
  });
  console.log(`✅ Admin inicial criado — usuário: ${username}`);
  console.log("   ⚠ Mude a senha imediatamente");
}

async function main() {
  await ensureRoles();
  await ensureAdmin();
}

main()
  .catch((e) => { console.error("Startup seed error:", e); })
  .finally(() => prisma.$disconnect());
