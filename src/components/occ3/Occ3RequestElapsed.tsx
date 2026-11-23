"use client";

import { useEffect, useState } from "react";

/** Keep per-second progress updates out of the conversation/composer render tree. */
export function Occ3RequestElapsed() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const started = Date.now();
    const tick = () => setSeconds(Math.floor((Date.now() - started) / 1000));
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, []);

  return <div className="occ3-processing-meta">
    <span data-testid="occ3-elapsed" aria-hidden="true">{seconds}s elapsed</span>
    {seconds >= 10 && <span className="occ3-processing-slow">Still working. You can stop this response without losing your chat.</span>}
  </div>;
}
