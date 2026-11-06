import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./templates.css";
import "./resume.css";
import "./ingest.css";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { VerifyBanner } from "@/components/auth/VerifyBanner";
import { StorageScope } from "@/components/auth/StorageScope";
import { auth } from "@/lib/auth/auth";
import { ConsentedAnalytics } from "@/components/analytics/ConsentedAnalytics";
import { CookieBanner } from "@/components/analytics/CookieBanner";
import { PurchaseTracker } from "@/components/analytics/PurchaseTracker";
import { SignupTracker } from "@/components/analytics/SignupTracker";
import { buildStructuredData } from "@/lib/seo/structuredData";
import { publicMetadata, SITE_URL } from "@/lib/seo/metadata";
import { TEMPLATE_COUNT } from "@/lib/templates/catalog";

const TITLE = "Orire — AI CV Studio & Professional Resume Templates";
const DESCRIPTION = `Upload your CV, re-brand it into a clean template, tailor it to any job, and export an ATS-ready PDF. ${TEMPLATE_COUNT} templates; AI that never invents experience.`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  ...publicMetadata(TITLE, DESCRIPTION, "/"),
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
  // Dark is the only theme shown; set before first paint to avoid a flash.
  const themeScript = `document.documentElement.setAttribute('data-theme','dark');`;
  return (
    <html lang="en" className="h-full antialiased" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(buildStructuredData(SITE_URL)) }}
        />
      </head>
      <body className="min-h-full">
        <AuthProvider session={session}>
          {/* Bind CV/library/target/plan localStorage keys to the current account. */}
          <StorageScope />
          <VerifyBanner />
          {children}
          <SignupTracker isNewUser={session?.isNewUser === true} userId={session?.user?.id ?? null} />
        </AuthProvider>
        <ConsentedAnalytics />
        <PurchaseTracker />
        <CookieBanner />
      </body>
    </html>
  );
}
