export function parseJsonField<T>(val: unknown, fallback: T): T {
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      if (typeof fallback === "object" && !Array.isArray(fallback) && fallback !== null) {
        if (typeof parsed === "object" && !Array.isArray(parsed) && parsed !== null) return parsed;
        return fallback;
      }
      if (Array.isArray(fallback)) {
        if (Array.isArray(parsed)) return parsed as T;
        return fallback;
      }
      return parsed;
    } catch { return fallback; }
  }
  return val as T;
}
