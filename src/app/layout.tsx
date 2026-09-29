import type { Metadata } from "next";
import "./globals.css";
import "./templates.css";

export const metadata: Metadata = {
  title: "orire — CV studio",
  description: "Rebrand and refine your CV with elegant, animated templates.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
