import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const adminCount = await prisma.admin.count();
  const storeCount = await prisma.store.count();
  const productCount = await prisma.product.count();
  const orderCount = await prisma.order.count();
  
  console.log("Admin count:", adminCount);
  console.log("Store count:", storeCount);
  console.log("Product count:", productCount);
  console.log("Order count:", orderCount);
  
  const stores = await prisma.store.findMany();
  console.log("Stores:", JSON.stringify(stores, null, 2));
  
  const admins = await prisma.admin.findMany({
    select: { id: true, username: true, email: true, createdAt: true }
  });
  console.log("Admins:", JSON.stringify(admins, null, 2));
  
  const products = await prisma.product.findMany({
    select: { id: true, name: true, price: true, active: true }
  });
  console.log("Products:", JSON.stringify(products, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());