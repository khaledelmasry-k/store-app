export function computeTotalStock(vs: Record<string, Record<string, number>>): number {
  let total = 0;
  for (const sizes of Object.values(vs)) {
    for (const qty of Object.values(sizes)) {
      total += qty;
    }
  }
  return total;
}
