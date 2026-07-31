import bcrypt from "bcryptjs";
import { prisma } from "./utils/prisma.js";

async function main() {
  const existing = await prisma.admin.findUnique({ where: { username: "admin" } });
  if (!existing) {
    const passwordHash = await bcrypt.hash("admin123", 10);
    await prisma.admin.create({
      data: { username: "admin", email: "admin@mkstore.com", passwordHash, role: "super_admin" },
    });
    console.log("Seed complete: super admin created (admin / admin123)");
  } else {
    console.log("Seed complete: super admin already exists, skipping");
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());