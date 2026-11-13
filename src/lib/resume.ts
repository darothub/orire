/** Set before first paint so a refresh never flashes the landing or Home. */
export const RESUME_SCRIPT = `try{if(sessionStorage.getItem("orire:view"))document.documentElement.setAttribute("data-resume","1")}catch(e){}`;

export function clearResumeOverlay(): void {
  if (typeof document !== "undefined") document.documentElement.removeAttribute("data-resume");
}
