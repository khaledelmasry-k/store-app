import { Prisma } from "@prisma/client";

/**
 * Generate the next sequential order number (e.g. ORD-00042) inside a transaction.
 * A Postgres advisory lock serializes concurrent generators so that no two
 * requests can produce the same number.
 */
export async function generateOrderNumber(tx: Prisma.TransactionClient): Promise<string> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(727100)`;
  const latest = await tx.order.findFirst({
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
