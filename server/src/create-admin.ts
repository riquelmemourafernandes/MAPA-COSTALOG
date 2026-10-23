import bcrypt from "bcryptjs";
import { PrismaClient, UserRole } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const name = process.env.ADMIN_NAME?.trim();
  const email = process.env.ADMIN_EMAIL?.trim().toLocaleLowerCase("pt-BR");
  const password = process.env.ADMIN_PASSWORD || "";
  if (!name || !email || !email.includes("@") || password.length < 8) {
    throw new Error("Configure ADMIN_NAME, ADMIN_EMAIL e ADMIN_PASSWORD com uma senha de pelo menos 8 caracteres.");
  }
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new Error("Este e-mail já existe. O script não altera usuários existentes.");
  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.create({
    data: { name, email, passwordHash, role: UserRole.ADMIN, active: true }
  });
  console.log("Administrador inicial criado. A senha não foi exibida nem armazenada no repositório.");
}

main()
  .catch((error) => {
    console.error("Não foi possível criar o administrador:", error instanceof Error ? error.message : "erro desconhecido");
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
