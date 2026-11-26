"use client";

import type { ReactNode } from "react";
import { V4FrameHead } from "./V4FrameHead";
import { V4Shell } from "./V4Shell";

/**
 * The Copilot's frame inside the v4 shell: the studio header with the Copilot
 * switch on, the Copilot panel in the slot the studio tools use, and the chat
 * filling the rest of the viewport (the chat scrolls inside it, so the page
 * itself never leaves empty space below).
 */
export function V4CopilotFrame({ panel, drawerOpen, onCloseDrawer, children }: { panel: ReactNode; drawerOpen: boolean; onCloseDrawer: () => void; children: ReactNode }) {
  return (
    <V4Shell active="copilot" label="Copilot">
      <div className="v4-frame v4-frame--chat">
        <V4FrameHead subtitle="Ask in plain words. Switch Copilot off for the studio tools." copilotOn />
        <div className={`v4-frame-body v4-cop-body${drawerOpen ? " v4-cop-body--open" : ""}`}>
          <button type="button" className="v4-cop-backdrop" aria-label="Close Copilot menu" tabIndex={drawerOpen ? 0 : -1} onClick={onCloseDrawer} />
          {panel}
          <div className="v4-frame-content v4-cop-content">{children}</div>
        </div>
      </div>
    </V4Shell>
  );
}
