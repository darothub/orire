import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Support — Orire",
  description: "Get help with Orire — send us a question, bug report or feedback and we’ll reply by email.",
  alternates: { canonical: "/support" },
};

export default function SupportLayout({ children }: { children: React.ReactNode }) {
  return children;
}
