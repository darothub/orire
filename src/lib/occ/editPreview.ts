/** Replaces exactly one explicitly chosen CV passage in a local working copy.
 * Never writes to the database, store, or master CV. */
export type LocalEdit = { before: string; after: string };
export function previewCvEdit(original: string, edit: LocalEdit): string | null {
  if (!edit.before || edit.before.length < 10 || !edit.after.trim() || edit.after.length > 1000) return null;
  const first = original.indexOf(edit.before);
  if (first < 0 || original.indexOf(edit.before, first + edit.before.length) !== -1) return null;
  return original.slice(0, first) + edit.after.trim() + original.slice(first + edit.before.length);
}
