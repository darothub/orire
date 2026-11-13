import { privateMetadata } from "@/lib/seo/metadata";

export const metadata = privateMetadata("Signing you in | Orire");

export default function PrivateLayout({ children }: { children: React.ReactNode }) {
  return children;
}
