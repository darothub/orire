export type OccDecision = "pending" | "accepted" | "rejected";
export function readDecision(value: unknown): OccDecision | null {
  return value === "accepted" || value === "rejected" || value === "pending" ? value : null;
}
export function updateDecision(items: unknown, index: number, decision: OccDecision): unknown[] | null {
  if (!Array.isArray(items) || !Number.isInteger(index) || index < 0 || index >= items.length) return null;
  if (!items[index] || typeof items[index] !== "object" || Array.isArray(items[index])) return null;
  return items.map((item, i) => i === index ? { ...item, decision } : item);
}
