import { V4Refine } from "@/components/v4/V4Refine";
import { requireV4Access, v4Metadata } from "@/lib/v4/access";

export const dynamic = "force-dynamic";
export const metadata = v4Metadata("Refine");

export default async function V4RefinePage() {
  await requireV4Access();
  return <V4Refine />;
}
