import { V4Home } from "@/components/v4/V4Home";
import { V4_DYNAMIC, requireV4Access, v4Metadata } from "@/lib/v4/access";

export const dynamic = V4_DYNAMIC;
export const metadata = v4Metadata("Home");

/**
 * Orire v4 Home. A standalone route, separate from /occ/v4 (the conversation),
 * with the same authorization: its pipeline reads the OCC account routes, so it
 * is available to the same accounts.
 */
export default async function V4HomePage() {
  await requireV4Access();
  return <V4Home />;
}
