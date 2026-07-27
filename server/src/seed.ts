import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.admin.findUnique({ where: { username: "admin" } });
  if (!existing) {
    const passwordHash = await bcrypt.hash("admin123", 10);
    await prisma.admin.create({
      data: { username: "admin", email: "admin@store.com", passwordHash },
    });
    console.log("Admin created: admin / admin123");
  } else {
    console.log("Admin already exists");
  }

  const product = await prisma.product.findFirst();
  if (!product) {
    await prisma.product.create({
      data: {
        name: "بنطلون كتان فرنساوي",
        description: "بنطلون كتان فرنساوي فاخر، مصنوع من أجود أنواع الكتان الفرنسي الطبيعي 100%. يتميز بنسيجه الناعم وخفة وزنه الفائقة، مما يجعله مثالياً للأجواء الحارة والمناخ المصري. قصة عصرية عالية الخصر مع كسرات أمامية أنيقة، وجيوب عملية، وحزام خصر مطاطي لراحة تامة. مثالي للإطلالات الرسمية والكاجوال على حد سواء.",
        price: 500,
        oldPrice: 699,
        pricingTiers: JSON.stringify({ "1": 500, "2": 900, "3": 1200, "4": 1400 }),
        variantStock: JSON.stringify({
          "أسود": { "L": 10, "XL": 10, "XXL": 10 },
          "بيج": { "L": 10, "XL": 10, "XXL": 10 },
          "زيتي": { "L": 10, "XL": 10, "XXL": 10 },
          "أبيض": { "L": 10, "XL": 10, "XXL": 10 },
        }),
        images: JSON.stringify({}),
        colors: JSON.stringify(["أسود", "بيج", "زيتي", "أبيض"]),
        sizes: JSON.stringify(["L", "XL", "XXL"]),
        active: true,
      },
    });
    console.log("Default product created with variant stock");
  } else {
    console.log("Product already exists");
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
