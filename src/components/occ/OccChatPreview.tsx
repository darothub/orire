"use client";
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import Link from "next/link";
import type { CVData } from "@/lib/cv/schema";
import { cvToPlainText } from "@/lib/export/plaintext";
import { looksLikeCV, looksLikeJobDescription } from "@/lib/occ/document-validation";
import type { OccAdvice } from "@/lib/occ/recommendations";
import "./occ-chat-preview.css";

type Agent = "review" | "coach" | "interview" | "improve" | "memory";
type Phase = "cv" | "choice" | "jd" | "ready";
type Message = { id: number; role: "user" | "occ"; text: string; attachment?: string; choice?: boolean; jdPrompt?: boolean; advice?: OccAdvice; reviewKind?: "general" | "targeted" };
type SavedCV = { id: string; title: string; data: CVData };
const AGENTS: { id: Agent; label: string }[] = [
  { id: "review", label: "Review" }, { id: "coach", label: "Coach" },
  { id: "interview", label: "Interview" }, { id: "improve", label: "Improve CV" },
  { id: "memory", label: "Career Memory" },
];
const welcome: Message = { id: 0, role: "occ", text: "Welcome to Orire Career Copilot. Attach your CV to get started, or ask me a career question." };

export function OccChatPreview() {
  const [messages, setMessages] = useState<Message[]>([welcome]);
  const [composer, setComposer] = useState("");
  const [agent, setAgent] = useState<Agent>("review");
  const [phase, setPhase] = useState<Phase>("cv");
  const [cv, setCv] = useState("");
  const [cvName, setCvName] = useState("");
  const [jd, setJd] = useState("");
  const [jdName, setJdName] = useState("");
  const [pendingAttachment, setPendingAttachment] = useState(false);
  const [menu, setMenu] = useState(false);
  const [agentMenu, setAgentMenu] = useState(false);
  const [saved, setSaved] = useState<SavedCV[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const sequence = useRef(1);
  const attachedKind = useRef<"cv" | "jd">("cv");
  const latestChoice = messages.findLast(m => m.choice);
  const latestJdPrompt = messages.findLast(m => m.jdPrompt);
  const push = (...items: Omit<Message,"id">[]) => {
    setMessages(current => current.concat(items.map(item => ({ ...item, id: sequence.current++ }))));
  };
  useEffect(() => { bottom.current?.scrollIntoView({ block: "end", behavior: "auto" }); }, [messages, busy]);
  useEffect(() => {
    void fetch("/api/occ/versions", { cache: "no-store" })
      .then(async r => { if (!r.ok) throw Error("Unavailable"); return r.json(); })
      .then(data => setSaved((data.documents || []) as SavedCV[]))
      .catch(() => {});
  }, []);
  function reset() {
    setMessages([welcome]); sequence.current = 1; setComposer(""); setPhase("cv");
    setCv(""); setCvName(""); setJd(""); setJdName(""); setPendingAttachment(false); setError(""); setMenu(false);
    setSidebarOpen(false); setAgent("review");
  }
  function chooseSaved(item: SavedCV) {
    const text = cvToPlainText(item.data);
    setCv(text); setCvName(item.title); setPendingAttachment(true); setMenu(false); setError("");
  }
  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || busy) return;
    const kind = attachedKind.current;
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!ext || !["pdf","docx","txt"].includes(ext)) { setError("Use a PDF, DOCX or TXT file."); return; }
    if (!file.size || file.size > (ext === "txt" ? 1024 * 1024 : 15 * 1024 * 1024)) {
      setError("The selected file is empty or exceeds its upload limit."); return;
    }
    setBusy(true); setError(""); setMenu(false);
    try {
      let text = "";
      if (ext === "txt") text = await file.text();
      else {
        const data = new FormData(); data.append("files",file);
        const response = await fetch("/api/parse", { method:"POST",body:data,cache:"no-store" });
        const body = await response.json();
        if (!response.ok || body.files?.[0]?.error) throw Error(body.files?.[0]?.error || body.error || "Unable to parse file.");
        text = body.files?.[0]?.text || "";
      }
      text = text.trim();
      const limit = kind === "cv" ? 30000 : 15000;
      if (text.length > limit || text.length < 30) throw Error("File text must be between 30 and " + limit + " characters.");
      if (kind === "cv" && !looksLikeCV(text)) throw Error("This does not appear to be a CV.");
      if (kind === "jd" && !looksLikeJobDescription(text)) throw Error("This does not appear to be a job description.");
      if (kind === "cv") { setCv(text); setCvName(file.name); setPendingAttachment(true); }
      else { setJd(text); setJdName(file.name); setPendingAttachment(true); }
    } catch(e) { setError(e instanceof Error ? e.message : "Unable to read this document."); }
    finally { setBusy(false); }
  }
  async function analyze(kind: "general" | "targeted", sourceCv: string, sourceJd = "") {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(kind === "general" ? "/api/occ/general-review" : "/api/occ/advise", {
        method:"POST",headers:{"Content-Type":"application/json"},
        body: JSON.stringify(kind === "general" ? {cv:sourceCv} : {cv:sourceCv,description:sourceJd,goal:"Review the attached CV against this job description",saveRun:false,useSavedProfile:false}),
      });
      const data = await response.json();
      if (!response.ok || !data.advice) throw Error(data.error || "The review could not be completed.");
      push({ role:"occ",text:kind === "general" ? "Here is your general CV review." : "Here is your CV review against the job description.", advice:data.advice as OccAdvice,reviewKind:kind });
      setPhase("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Review unavailable.");
      push({ role:"occ",text:"I could not complete the review. Your documents are still attached, so you can retry." });
    } finally { setBusy(false); }
  }
  function chooseReview(choice: "general" | "jd") {
    if (!cv.trim() || busy || !latestChoice || messages.at(-1)?.id !== latestChoice.id) return;
    push({role:"user",text:choice === "general" ? "General review" : "I have a job description"});
    if (choice === "general") { void analyze("general",cv); return; }
    setPhase("jd");
    push({role:"occ",text:"Great. Paste the job description into the message box or attach a PDF, DOCX or TXT file.",jdPrompt:true});
  }
  function attach() { attachedKind.current = phase === "jd" ? "jd" : "cv"; fileInput.current?.click(); setMenu(false); }
  function submit(event?: FormEvent) {
    event?.preventDefault();
    if (busy) return;
    const text = composer.trim();
    const hasAttachment = pendingAttachment;
    if (!text && !hasAttachment) return;
    const isCv = phase === "cv";
    const isJd = phase === "jd";
    if (isJd) {
      const sourceJd = text && looksLikeJobDescription(text) ? text : jd;
      if (!sourceJd || !looksLikeJobDescription(sourceJd)) { setError("Please paste or attach a job description with role details."); return; }
      setJd(sourceJd); setPendingAttachment(false); setComposer("");
      push({role:"user",text:text && looksLikeJobDescription(text) ? "Job description shared" : "Job description attached",attachment:jdName || undefined});
      void analyze("targeted",cv,sourceJd); return;
    }
    if (isCv && hasAttachment && cv) {
      push({role:"user",text:text || "My CV",attachment:cvName});
      setPendingAttachment(false); setComposer(""); setPhase("choice");
      push({role:"occ",text:"I've received your CV. Would you like a general review, or should I review it against a specific job description?",choice:true});
      return;
    }
    if (phase === "choice" && text) {
      if (/\b(general|overall)\b/i.test(text)) { setComposer(""); chooseReview("general"); return; }
      if (/\b(job description|specific role|jd)\b/i.test(text)) { setComposer(""); chooseReview("jd"); return; }
    }
    if (text) {
      setComposer(""); push({role:"user",text});
      if (!cv) push({role:"occ",text:"Attach your CV using the paperclip, then press Send. I can guide you from there."});
      else if (agent === "review") push({role:"occ",text:"You can start a general review, or share a target job description for a specific review.",choice:true});
      else push({role:"occ",text:"This is a UI preview. Your selected specialist is " + AGENTS.find(a=>a.id===agent)?.label + ". Its full conversation flow remains in the existing OCC while the new interface is being integrated."});
    }
  }
  const visibleMessages = messages;
  return (
    <main className="occ3-shell">
      <aside className={"occ3-sidebar" + (sidebarOpen ? " occ3-sidebar-open":"")} aria-label="Conversation navigation">
        <div className="occ3-brand"><span className="occ3-flower">⚜</span><strong>Orire</strong></div>
        <p className="occ3-brand-sub">Career Copilot <span>OCC 3.0</span></p>
        <button className="occ3-new" onClick={reset}>＋ &nbsp; New chat</button>
        <div className="occ3-history-heading">PREVIEW SESSION</div>
        <button className="occ3-history-item" onClick={()=>setSidebarOpen(false)}>Current conversation</button>
        <p className="occ3-history-hint">Preview conversations are not saved. No CV changes are applied automatically.</p>
        <div className="occ3-side-bottom"><Link href="/occ">Return to existing OCC</Link></div>
      </aside>
      <div className="occ3-main">
        <header className="occ3-topline">
          <button className="occ3-hamburger" type="button" onClick={()=>setSidebarOpen(!sidebarOpen)} aria-label="Toggle conversation sidebar">☰</button>
          <span>Career Copilot <span className="occ3-preview-pill">DESIGN PREVIEW</span></span>
          <Link href="/occ" className="occ3-return">Existing OCC ↗</Link>
        </header>
        <section className="occ3-thread" aria-label="OCC 3 conversation">
          {visibleMessages.length === 1 && <div className="occ3-hero"><div className="occ3-hero-mark">⚜</div><h1>Orire <span>Career Copilot</span></h1><p>Your AI partner for CV review, interview preparation, CV improvement and career planning.</p></div>}
          <div className="occ3-stream">
            {visibleMessages.map(message => <article className={"occ3-message occ3-" + message.role} key={message.id}>
              {message.role === "occ" && <div className="occ3-avatar" aria-hidden="true">⚜</div>}
              <div className="occ3-message-body">
                {message.attachment && <div className="occ3-document"><span>▤</span><div><strong>{message.attachment}</strong><small>Document attached</small></div><span aria-label="Attachment received">✓</span></div>}
                {message.text && <p>{message.text}</p>}
                {message.choice && messages.at(-1)?.id === message.id && <div className="occ3-choices">
                  <button disabled={busy} onClick={()=>chooseReview("general")}>General review</button>
                  <button disabled={busy} onClick={()=>chooseReview("jd")}>I have a job description</button>
                </div>}
                {message.advice && <div className="occ3-review" role="region" aria-label={message.reviewKind === "general" ? "General CV review" : "Job-specific CV review"}>
                  <h2>CV Review <span>{message.reviewKind === "general" ? "General" : "Job-specific"}</span></h2>
                  <p>{message.advice.summary}</p>
                  {message.advice.recommendations.map((item,i)=><div className="occ3-finding" key={i}>
                    <strong>{item.requirement}</strong><p>{item.suggestion}</p>
                    {item.cvEvidence && <details><summary>View CV evidence</summary><blockquote>{item.cvEvidence}</blockquote></details>}
                    {item.question && <p className="occ3-verify">To verify: {item.question}</p>}
                  </div>)}
                  {message.advice.nextSteps.length > 0 && <details><summary>Suggested next steps</summary><ul>{message.advice.nextSteps.map((step,i)=><li key={i}>{step}</li>)}</ul></details>}
                  <p className="occ3-disclaimer">Suggestions require your verification. No CV changes are applied.</p>
                </div>}
              </div>
            </article>)}
            {busy && <div className="occ3-loading" role="status">Orire is processing your document or review…</div>}
            <div ref={bottom} />
          </div>
        </section>
        <div className="occ3-composer-wrap">
          {error && <p className="occ3-error" role="alert">{error}</p>}
          <form className="occ3-composer" aria-label="OCC 3 message composer" onSubmit={submit}>
            {(pendingAttachment && (phase === "jd" ? jdName : cvName)) && <div className="occ3-attachment-chip"><span>▤</span>{phase === "jd" ? jdName : cvName}<button type="button" aria-label="Remove attachment" onClick={()=>{if(phase==="jd"){setJd("");setJdName("");}else{setCv("");setCvName("");}setPendingAttachment(false);}}>×</button></div>}
            <div className="occ3-input-row">
              <div className="occ3-attach-area">
                <button type="button" className="occ3-paperclip" title={phase === "jd" ? "Attach job description" : "Attach CV"} aria-label="Attach document" aria-expanded={menu} onClick={()=>setMenu(!menu)} disabled={busy}>
                  <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="m21 11.5-8.2 8.2a6 6 0 0 1-8.5-8.5L13.2 2.3a4 4 0 0 1 5.7 5.7l-9.1 9.1a2 2 0 0 1-2.8-2.8l8.4-8.4"/></svg>
                </button>
                {menu && <div className="occ3-attach-menu" role="menu">
                  <button type="button" role="menuitem" onClick={attach}>{phase === "jd" ? "Upload job description" : "Upload CV"}</button>
                  {phase !== "jd" && saved.length > 0 && <div className="occ3-saved-list"><small>Choose from my CVs</small>{saved.map(item=><button role="menuitem" key={item.id} type="button" onClick={()=>chooseSaved(item)}>{item.title}</button>)}</div>}
                </div>}
              </div>
              <textarea aria-label="Message Orire Career Copilot" value={composer} onChange={e=>setComposer(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();submit();}}} maxLength={15000} rows={1} placeholder={phase==="jd" ? "Paste the job description or type a message…" : phase==="cv" ? "Attach your CV or type a message…" : "Message Orire Career Copilot…"} />
              <div className="occ3-agent-area">
                <button type="button" className="occ3-agent" aria-label="Select agent" aria-expanded={agentMenu} disabled={busy} onClick={()=>setAgentMenu(!agentMenu)}>{AGENTS.find(a=>a.id===agent)?.label} <span>⌄</span></button>
                {agentMenu && <div className="occ3-agent-menu" role="menu">{AGENTS.map(item=><button key={item.id} role="menuitemradio" aria-checked={item.id===agent} type="button" onClick={()=>{setAgent(item.id);setAgentMenu(false);}}>{item.label}{item.id===agent ? " ✓":""}</button>)}</div>}
              </div>
              <button aria-label="Send message" className="occ3-send" disabled={busy || (!composer.trim() && !pendingAttachment)} type="submit">➤</button>
            </div>
            <input type="file" ref={fileInput} accept=".pdf,.docx,.txt" aria-label="Upload career document" className="occ3-file-hidden" onChange={e=>void upload(e)}/>
          </form>
          <p className="occ3-footer">OCC can make mistakes. Verify all career claims. Preview conversations are not saved.</p>
        </div>
      </div>
    </main>
  );
}
