# Orire + OCC — UI/UX Specification (Web & Mobile)

*Build-ready design spec for the Orire app and the Orire Career Copilot (OCC). Any engineer or AI agent should be able to build the UI from this document alone. Pairs with the design system in `../design/design-system/` (tokens + components) and the interactive reference prototypes linked in `README.md`.*

**Related docs:** strategy in `occ.md` / the architecture critique; the design system (tokens + components) in `design-system/`. Stack is Next.js 16 / React 19 + framer-motion + zustand, so everything here maps to CSS variables + React components.

---

## 0. Product model (read first)

- **Orire** is the app — a CV *studio*: import a CV, tailor it to a job, simulate the ideal candidate, score it, export, track applications.
- **OCC (Orire Career Copilot)** is **a conversational layer over Orire** — it does not replace the direct surfaces, it makes every Orire feature reachable *through chat*. "Tailor my CV for Stripe," "how do I match?", "switch my template," "draft a cover letter" each run the real feature and return a **rich result card** inline, with a one-tap handoff to the full surface (Studio / Simulate / Library).
- Design implication: **feature logic lives once**; both the direct UI (Studio, Simulate…) and OCC call it. OCC's output is the same data rendered as a chat card. Never build a second, chat-only version of a feature.

The app therefore has two kinds of surface:
1. **Copilot (OCC)** — conversational entry point (default landing).
2. **Direct surfaces** — Home, Simulate, Studio, Library, Applications.

---

## 1. Design tokens

See `design-system/tokens.json` for the authoritative values. Dark is primary; light is a full peer theme via `[data-theme]`.

### 1.1 Color — "Ink + Fortune"
Concept: a warm violet-ink canvas (not near-black, not cream), **violet** = the copilot/AI, **gold** = reserved for *match / success / achievement* moments ("Orire" = good fortune). Cool-AI + warm-fortune is the signature; never spend gold on ordinary chrome. Full token table (dark/light) in `tokens.json` → `color.tokens`.

Semantic mapping: **violet** = primary/AI, **gold** = the match payoff, **match (green)** = resolved/strong, **gap (coral)** = missing/at-risk. Status is never carried by color alone (always paired with a label or icon).

### 1.2 Typography
- **Display / headings / big numbers:** `Bricolage Grotesque` (400–800). Page titles, stat values, match %, card headers.
- **UI / body:** `Inter` (400–700). Everything else.
- Numbers use `font-variant-numeric: tabular-nums`.
- Type scale (desktop): page H1 30px/700, section H2 18px/600, card title 14–16px/600, body 13.5–14.5px, label 11.5–12.5px, micro 10.5–11px. Full scale in `tokens.json` → `type.groups`.
- **Do not** use all-caps labels, single-word accent coloring, or a mono font for data.

### 1.3 Space, radius, motion, elevation
- **Spacing** 4pt scale; **radius** five steps (sm 9 / md 14 / lg 20 / xl 28 / pill 999); match radius to element size. **Elevation** two shadows only. All in `tokens.json`.
- **Easing** `cubic-bezier(.16,1,.3,1)`; 150–200ms micro, 400–500ms view/reveal.
- **Motion budget:** one orchestrated reveal (the match ring filling) + motion that answers an action (view switch, diff accept, message enter). No fade-up on every card. Respect `prefers-reduced-motion`.

---

## 2. Layout system & breakpoints

```
Breakpoints:  mobile ≤ 560   ·   tablet 561–860   ·   desktop ≥ 861
Content max-width: 1280px, centered.
```

### 2.1 Desktop shell
```
┌──────────────────────────────────────────────────────────┐
│ TOPBAR  [logo Orire·Career Copilot]  [⌘K search]   [plan][☾][avatar] │ 62px
├───────────┬──────────────────────────────────────────────┤
│ SIDEBAR   │  MAIN (scrolls; one active view)              │
│ 248px     │   Copilot · Home · Simulate · Studio ·        │
│ nav +     │   Library · Applications                      │
│ upsell    │                                               │
└───────────┴──────────────────────────────────────────────┘
```
- Sidebar order: **Copilot (OCC)** · Home · Simulate the gap · CV Studio · Version library · Applications, then a Documents group (Cover letters, Interview prep), then a share-link upsell pinned bottom.
- Active nav item: `--surface-2` fill, violet left-rail bar (3px), violet icon.
- `⌘K` opens the command palette (fuzzy jump + "ask the copilot" entry).

### 2.2 Mobile shell (≤ 860 collapses, ≤ 560 is phone)
```
┌─────────────────────────────┐
│ ☰  Orire        [☾] [avatar] │ 56–62px
├─────────────────────────────┤
│  MAIN (single column, scroll)│
├─────────────────────────────┤
│ [✦]  [⌂]  [✦gap]  [▦]  [•••] │ 56px  BOTTOM TAB BAR
│ Copilot Home Simulate Studio More │
└─────────────────────────────┘
```
- On phone the sidebar becomes a **bottom tab bar** (Copilot, Home, Simulate, Studio, More). "More" opens a sheet with Library, Applications, Cover letters, settings, upsell.
- **OCC is the default tab on mobile** — conversation is the most thumb-friendly way to drive the app.
- All multi-column desktop layouts collapse to one column; the 3-pane Studio becomes **segmented tabs**.

---

## 3. Component library

See `design-system/components/` for live previews and guidelines. Summary:

- **Button** — primary (violet), gold (the match/refine payoff — at most one per view), ghost. Heights 42/34.
- **Card** — `--surface` + `--line` + `--shadow-soft`, radius `--r-lg`.
- **Stat tile** — icon chip, Bricolage value, delta row; count up on reveal.
- **Match ring** — SVG, animate `stroke-dashoffset` + number count-up. Gold on Home ("best current match"), green on a run result.
- **Status pill** — Saved (muted) / Applied (violet) / Interview (gold) / Offer (match).
- **Diff block** — struck-through old + green new + "why / nothing invented" + Accept/Reject. The trust primitive, reused by Studio bullet-improve, full Refine, and OCC.
- **Chat message / Copilot card** — how OCC renders a feature result inline (header + body + handoff action); ≤ 420px.
- **CV paper** — `--page` surface, the live preview; supports template variants and inline edit.
- **Logo** — the Burst brand mark (gold axes + violet diagonals); variants + lockups in `design-system/components/Logo/`.
- Also: Toggle, Chip, Toast, Command palette, Progress stepper.

---

## 4. OCC — conversational spec (the headline surface)

**Purpose:** run any Orire feature by conversation; return a rich card + a handoff.

**Layout (desktop & mobile):** fixed-height column — header (identity + current context chip) · scrolling thread · composer (suggested-prompt chips + input + send). Thread max-width ~720px, messages left (bot) / right (user).

**Opening state:** greeting (time-aware) + the single **Recommended-next card** (same logic as Home's spotlight). Suggested chips: *Tailor my CV for [role]* · *How well do I match?* · *Change my template* · *Draft a cover letter*.

**Intent → card mapping (minimum viable NLU):**
| Intent (keywords) | Feature run | Card returned | Handoff |
|---|---|---|---|
| tailor / refine / improve / rewrite | Refine (full CV) | Refine summary (N changes, before→after, match Δ) | "Review in Studio", "Save as version" |
| match / score / gap / fit | Simulate (score only) | Match analysis (mini-ring + gap list) | "Open full simulation", "Close the gaps" |
| template / layout / design / look | Template catalog | Template picker (ATS vs Design badges) | tap applies + "fine-tune in Studio" |
| cover / letter | Cover-letter draft | Cover-letter draft (grounded excerpt) | "Open in editor" |
| library / versions | Library query | version list card | "Open library" |
| fallback | — | capability prompt | — |

**Rules:** every card states grounding ("fact-grounded / nothing invented") where AI wrote content; every card has at least one handoff to its full surface; a card action that mutates the CV (apply refine, apply template) reflects immediately in Studio's shared state. Streaming / "assistant busy, retrying" states reuse the existing failover UI.

**Entry points:** the Copilot nav item/tab, the `⌘K` palette, and a persistent "Ask Orire" affordance (OCC is a layer over all surfaces).

**Mobile:** default tab; composer docks above the bottom tab bar; chips scroll horizontally; cards full-width.

---

## 5. Screen specs (web + mobile)

### 5.1 Home / Overview
- **Hero row (web):** left = Recommended-next spotlight (one CTA, spotlights the next best action); right = best-current-match ring (gold).
- **Stat row:** 4 tiles (Active applications / Avg match / Interviews / Versions), count-up on view.
- **Grid-2:** Active pipeline list + Momentum bar chart (6 weeks; last bar gold).
- **Mobile:** hero stacks; stats 2×2; pipeline full-width; momentum below.

### 5.2 Simulate the gap (hero feature)
- **Web:** sticky left input (company / location / role / JD paste / gold Simulate CTA + grounding note); right stage: empty → progress stepper (Read JD → Model ideal → Match → Score) → result.
- **Result:** left match-ring card (green, animated) + verdict; right "ideal candidate vs you" gap items (have/partial/miss) each with a "Fix in Studio / Add evidence" action; a current→potential match bar (70% → 93%).
- **Mobile:** input collapses to a top form; result stacks ring above gap list; fix buttons full-width.

### 5.3 CV Studio — **Refine · Live edit · Templates**
**Web layout:**
```
┌ STUDIO BAR ─────────────────────────────────────────────┐
│ Template: [Modern ATS][Classic ATS][Editorial Design]   │
│                       [ Live edit ⃝ ]  [✦ Refine for Stripe]│
├──────────┬───────────────────────────┬──────────────────┤
│ BLOCKS   │   LIVE CV PREVIEW (paper)  │  QUALITY COACH   │
│ rail     │   numbered, reorderable    │  flags + ✨Improve│
│ (toggle, │   sections toggle on/off   │  per-bullet diff │
│  recommended-next highlight)          │                  │
└──────────┴───────────────────────────┴──────────────────┘
   ▼ REFINE PANEL (full-width) — N diffs, per-item + Accept all
```
- **(a) Template selection.** Chip row; each template carries an **ATS** (single-column, parse-safe) or **Design** badge. Selecting restyles the paper live. Reading order stays logical (CSS `order` only). Also surfaced in OCC as the Template-picker card.
- **(b) Live edit.** Toggle → CV paper text becomes directly editable (contenteditable); dashed edit affordance on hover, violet outline on focus; edits write to the active version.
- **(c) Refine (full-CV, JD-tailored).** Gold **Refine for [role]** runs a JD-grounded pass and opens the **Refine panel**: a list of proposed changes, each a diff with per-item Accept/Skip + a header Accept all/Dismiss. Distinct from the coach's single-bullet ✨ Improve. Both reuse the Diff block.
- **(d) Quality coach.** Deterministic per-bullet flags (weak verb, no metric, missing keyword) + on-demand AI Improve → single diff.
- **Block rail:** numbered, drag-reorder (keyboard move-earlier/later fallback + ARIA), toggle include/exclude, one "recommended next" highlight.
- **Mobile:** the 3 panes become segmented tabs — `Preview | Blocks | Coach`. Template chips scroll horizontally; Live edit + Refine a sticky action row; the Refine panel opens as a bottom sheet.

### 5.4 Version library
- Versions grouped by company; each card = thumbnail · name · meta · match badge · status; active version violet-outlined with an "Active" badge. A "Master CV" group (dashed) is the source everything tailors from.
- **Mobile:** one card per row (or 2-up on large phones).

### 5.5 Applications (outcome loop)
- Kanban: **Saved → Applied → Interview → Offer**; each card carries its match score + a note; column header has a colored dot + count. Each application links its CV version + cover letter + JD.
- **Mobile:** columns become horizontally-scrolling lanes, or a status filter + single list.

### 5.6 Cover letters / Export / Share (already built)
Reuse existing flows: PDF (ATS-safe invisible-text layer) + `.docx` + `.txt`/"copy for application form" + revocable noindex share link. Export view exposes the "include re-import data" toggle. OCC's cover-letter card hands off here.

---

## 6. Interaction & motion spec
- **View switch:** 0.5s fade+rise of the entering view only.
- **Match ring:** dashoffset + number count-up, 1.3s ease-out — *the* signature reveal.
- **Simulate run:** staggered stepper ticks → result; gap items stagger in; match bar fills after.
- **Diff accept:** the bullet updates in place with a brief green highlight on the changed span.
- **Chat message:** 0.4s enter; ~420ms "thinking" delay before a bot card.
- **Reduced motion:** every animated value jumps to final.

---

## 7. Accessibility (hard floor)
- Visible keyboard focus everywhere (2px violet, 2px offset).
- Status never by color alone.
- Drag-reorder has a keyboard move-earlier/later fallback + `role=list/listitem` + live-region position announcements.
- Live CV preview + editor screen-reader navigable; lock/disabled states don't rely on grey alone.
- Command palette and OCC composer fully keyboard-operable; OCC messages in a live region.
- Text meets WCAG AA in both themes; the CV paper keeps its own high-contrast ink.

---

## 8. Handoff notes
- Tokens → CSS variables (the app's existing pattern); ship `[data-theme="dark"|"light"]`. Pull values from `design-system/tokens.json`.
- Fonts: Bricolage Grotesque + Inter (self-host).
- OCC cards are server-feature outputs rendered by a shared `<ResultCard>` family, **not** bespoke chat widgets.
- OCC, Studio, Library and Applications share one CV/version store so an action in any surface (incl. a chat card) is reflected everywhere.
- The reference prototypes (linked in `README.md`) are the visual source of truth for look & motion, not the architecture.
