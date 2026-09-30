import type { Metadata } from "next";
import "./globals.css";
import "./templates.css";
import "./resume.css";
import "./ingest.css";
import { AuthProvider } from "@/components/auth/AuthProvider";

export const metadata: Metadata = {
  title: "orire — CV studio",
  description: "Rebrand and refine your CV with elegant, animated templates.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
