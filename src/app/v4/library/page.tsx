import { V4Library } from "@/components/v4/V4Library";
import { V4_DYNAMIC, requireV4Access, v4Metadata } from "@/lib/v4/access";

export const dynamic = V4_DYNAMIC;
export const metadata = v4Metadata("Version library");

export default async function V4LibraryPage() {
  await requireV4Access();
  return <V4Library />;
}
