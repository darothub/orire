import { TEMPLATE_COUNT } from "@/lib/templates/catalog";

export type TrustStat = {
  value: string;
  label: string;
};

const STATS: TrustStat[] = [
  { value: String(TEMPLATE_COUNT), label: "out-of-this-world templates" },
  { value: "2×", label: "AI assistants compared side by side" },
  { value: "Role", label: "match guidance to review before applying" },
  { value: "0", label: "star bars or clipart — ever" },
];

export function trustStats(): TrustStat[] {
  return STATS.map((s) => ({ ...s }));
}
