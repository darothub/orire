"use client";

import { useEffect, useRef } from "react";
import Script from "next/script";
import { usePathname } from "next/navigation";
import { captureAttribution } from "@/lib/analytics/attribution";
import { META_PIXEL_ID, metaTrack } from "@/lib/analytics/meta";

/**
 * Loads the Meta Pixel (when `NEXT_PUBLIC_META_PIXEL_ID` is set) and records
 * campaign attribution from the landing URL. The app is largely a single page,
 * so PageView is re-sent on pathname changes; the initial one comes from the
 * init snippet below.
 */
export function MetaPixel() {
  const pathname = usePathname();
  const lastPath = useRef(pathname);

  useEffect(() => {
    captureAttribution();
  }, []);

  useEffect(() => {
    // Skip the initial render (the init snippet sends that PageView); comparing
    // paths also keeps React strict-mode's double effect from double-counting.
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    metaTrack("PageView");
  }, [pathname]);

  if (!META_PIXEL_ID) return null;

  return (
    <Script id="meta-pixel" strategy="afterInteractive">
      {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${META_PIXEL_ID}');fbq('track','PageView');`}
    </Script>
  );
}
