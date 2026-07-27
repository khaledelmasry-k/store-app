let counter = 0;

export async function generateOrderNumber(): Promise<string> {
  const { prisma } = await import("./prisma.js");
  const latest = await prisma.order.findFirst({
    orderBy: { createdAt: "desc" },
    select: { orderNumber: true },
  });
  let num = 1;
  if (latest) {
    const match = latest.orderNumber.match(/\d+$/);
    if (match) num = parseInt(match[0], 10) + 1;
  }
  return `ORD-${String(num).padStart(5, "0")}`;
}
