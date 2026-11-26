import { V4Export } from "@/components/v4/V4Export";
import { requireV4Access, v4Metadata } from "@/lib/v4/access";

export const dynamic = "force-dynamic";
export const metadata = v4Metadata("Export");

export default async function V4ExportPage() {
  await requireV4Access();
  return <V4Export />;
}
