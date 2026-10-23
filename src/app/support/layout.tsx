import { publicMetadata } from "@/lib/seo/metadata";

export const metadata = publicMetadata(
  "Support — Orire",
  "Get help with Orire — send us a question, bug report or feedback and we’ll reply by email.",
  "/support",
);

export default function SupportLayout({ children }: { children: React.ReactNode }) {
  return children;
}
