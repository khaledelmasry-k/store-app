import bcrypt from "bcryptjs";
import { prisma } from "./utils/prisma.js";

async function main() {
  const passwordHash = await bcrypt.hash("admin123", 10);
  await prisma.admin.upsert({
    where: { username: "admin" },
    update: { email: "admin@mkstore.com", passwordHash, role: "super_admin" },
    create: { username: "admin", email: "admin@mkstore.com", passwordHash, role: "super_admin" },
  });
  console.log("Seed complete: super admin created (admin / admin123)");
}

main().catch(console.error).finally(() => prisma.$disconnect());