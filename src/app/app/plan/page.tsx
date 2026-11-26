import { V4Plan } from "@/components/v4/V4Plan";
import { requireV4Access, v4Metadata } from "@/lib/v4/access";

export const dynamic = "force-dynamic";
export const metadata = v4Metadata("Plan and billing");

export default async function V4PlanPage() {
  await requireV4Access();
  return <V4Plan />;
}
