import { V4Export } from "@/components/v4/V4Export";
import { V4_DYNAMIC, requireV4Access, v4Metadata } from "@/lib/v4/access";

export const dynamic = V4_DYNAMIC;
export const metadata = v4Metadata("Export");

export default async function V4ExportPage() {
  await requireV4Access();
  return <V4Export />;
}
