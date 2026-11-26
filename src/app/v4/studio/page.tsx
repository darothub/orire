import { V4Studio } from "@/components/v4/V4Studio";
import { requireV4Access, v4Metadata } from "@/lib/v4/access";

export const dynamic = "force-dynamic";
export const metadata = v4Metadata("CV Studio");

export default async function V4StudioPage() {
  await requireV4Access();
  return <V4Studio />;
}
