import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./templates.css";
import "./resume.css";
import "./ingest.css";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { auth } from "@/lib/auth/auth";

export const metadata: Metadata = {
  title: "orire — CV studio",
  description: "Rebrand and refine your CV with elegant, animated templates.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Resolve the session on the server so the client knows the auth state on the
  // very first paint — no "loading" flash of the wrong page after login/logout.
  const session = await auth();
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">
        <AuthProvider session={session}>{children}</AuthProvider>
      </body>
    </html>
  );
}
