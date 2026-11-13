import { publicMetadata } from "@/lib/seo/metadata";
import { PricingView } from "@/components/landing/PricingView";

export const metadata = publicMetadata(
  "Pricing: start free | Orire",
  "Start free with one simulation and three rewrites. Choose Pro or Career when you need more Simulate, Coach and Rewrite. Prices in USD, renewed monthly.",
  "/pricing",
);

export default function PricingPage() {
  return <PricingView />;
}
