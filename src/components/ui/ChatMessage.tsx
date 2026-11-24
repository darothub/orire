import type { ReactNode } from "react";
import "./surfaces.css";

interface ChatMessageProps {
  /** Who sent it. */
  role: "bot" | "user";
  /** Message content (text, or a CopilotCard for a result). */
  children: ReactNode;
  /** Avatar contents. Defaults to the Orire glyph for the bot. */
  avatar?: ReactNode;
}

/**
 * One turn in the OCC thread: an avatar plus a bubble. Bot bubbles may contain a
 * CopilotCard. The user variant aligns right with the violet bubble.
 */
export function ChatMessage({ role, children, avatar }: ChatMessageProps) {
  return (
    <div className={`or-msg or-msg--${role}`}>
      <div className="or-msg__av" aria-hidden>
        {avatar ?? (role === "bot" ? "✦" : "")}
      </div>
      <div className="or-msg__bubble">{children}</div>
    </div>
  );
}
