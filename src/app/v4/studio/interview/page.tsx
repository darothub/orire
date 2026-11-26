import { V4Interview } from "@/components/v4/V4Interview";
import { requireV4Access, v4Metadata } from "@/lib/v4/access";

export const dynamic = "force-dynamic";
export const metadata = v4Metadata("Interview");

export default async function V4InterviewPage() {
  await requireV4Access();
  return <V4Interview />;
}
