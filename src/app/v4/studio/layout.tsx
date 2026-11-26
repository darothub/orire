import type { ReactNode } from "react";
import { V4StudioFrame } from "@/components/v4/V4StudioFrame";

/** Wraps Edit, Simulate and Refine in the studio frame. Each page still checks access. */
export default function V4StudioLayout({ children }: { children: ReactNode }) {
  return <V4StudioFrame>{children}</V4StudioFrame>;
}
