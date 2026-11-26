/** A copy of `list` with an empty bullet inserted right after `index` (appended when out of range). */
export function insertBlankAfter(list: readonly string[], index: number): string[] {
  const at = Math.min(Math.max(index + 1, 0), list.length);
  return [...list.slice(0, at), "", ...list.slice(at)];
}
