import { Occ4Workspace } from "@/components/occ4/Occ4Workspace";
import { requireV4Access, v4Metadata } from "@/lib/v4/access";

export const dynamic = "force-dynamic";
export const metadata = v4Metadata("Copilot");

export default async function V4CopilotPage() {
  await requireV4Access();
  return <Occ4Workspace shell="v4" />;
}
