export type TrustStat = {
  value: string;
  label: string;
};

const STATS: TrustStat[] = [
  { value: "20+", label: "out-of-this-world templates" },
  { value: "2×", label: "AI assistants compared side by side" },
  { value: "100%", label: "job-match simulation before you apply" },
  { value: "0", label: "star bars or clipart — ever" },
];

export function trustStats(): TrustStat[] {
  return STATS.map((s) => ({ ...s }));
}
