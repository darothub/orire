import { privateMetadata } from "@/lib/seo/metadata";

export const metadata = privateMetadata("Checkout — Orire");

export default function PrivateLayout({ children }: { children: React.ReactNode }) {
  return children;
}
