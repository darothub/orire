import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./templates.css";
import "./resume.css";
import "./ingest.css";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { VerifyBanner } from "@/components/auth/VerifyBanner";
import { auth } from "@/lib/auth/auth";
import { MetaPixel } from "@/components/analytics/MetaPixel";
import { PurchaseTracker } from "@/components/analytics/PurchaseTracker";
import { SignupTracker } from "@/components/analytics/SignupTracker";

const SITE_URL = process.env.APP_URL ?? "https://orire.app";
const TITLE = "Orire — CV studio";
const DESCRIPTION = "Rebrand and refine your CV with elegant, animated templates.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: "Orire",
    title: TITLE,
    description: DESCRIPTION,
    url: "/",
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
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
  // Applied before first paint so the chosen theme never flashes. Stored choice
  // wins; otherwise follow the OS. Defaults to dark (the brand default).
  const themeScript = `(function(){try{var t=localStorage.getItem('orire-theme');if(t!=='light'&&t!=='dark'){t=window.matchMedia&&window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';}document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`;
  return (
    <html lang="en" className="h-full antialiased" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full">
        <AuthProvider session={session}>
          <VerifyBanner />
          {children}
          <SignupTracker isNewUser={session?.isNewUser === true} userId={session?.user?.id ?? null} />
        </AuthProvider>
        <Analytics />
        <SpeedInsights />
        <MetaPixel />
        <PurchaseTracker />
      </body>
    </html>
  );
}
