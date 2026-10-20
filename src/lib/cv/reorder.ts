/**
 * Pure helpers backing the editor's keyboard-reorder fallback (move-earlier /
 * move-later buttons next to every drag handle — see EditorPanel.tsx). Pulled
 * out so the boundary/no-op logic is unit-testable without rendering React.
 *
 * Both return the SAME array reference, unchanged, when the move is a no-op
 * (item not found, or already at the boundary in that direction) — callers
 * use that to skip updating state and skip announcing a move that didn't
 * happen.
 */

/** Swap an id-keyed item with its neighbor in the given direction. */
export function moveById<T extends { id: string }>(list: T[], id: string, dir: -1 | 1): T[] {
  const idx = list.findIndex((x) => x.id === id);
  const to = idx + dir;
  if (idx < 0 || to < 0 || to >= list.length) return list;
  const next = [...list];
  [next[idx], next[to]] = [next[to], next[idx]];
  return next;
}

/** Swap the item at `index` with its neighbor in the given direction. */
export function moveAt<T>(list: T[], index: number, dir: -1 | 1): T[] {
  const to = index + dir;
  if (index < 0 || index >= list.length || to < 0 || to >= list.length) return list;
  const next = [...list];
  [next[index], next[to]] = [next[to], next[index]];
  return next;
}
