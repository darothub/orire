import { V4Simulate } from "@/components/v4/V4Simulate";
import { requireV4Access, v4Metadata } from "@/lib/v4/access";

export const dynamic = "force-dynamic";
export const metadata = v4Metadata("Simulate");

export default async function V4SimulatePage() {
  await requireV4Access();
  return <V4Simulate />;
}
