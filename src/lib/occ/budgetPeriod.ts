/** Pure date key shared by OCC usage-budget tests and policy. */
export function utcDay(date: Date): string { return date.toISOString().slice(0, 10); }
