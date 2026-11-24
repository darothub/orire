# Orire — Design → Implementation Plan

How we take the new design system live in the app, route by route, without a big-bang rewrite. Pairs with `ui-ux-spec.md` and `design-system/`.

## What exists now
- **Tokens:** `design-system/tokens.json` (source) → `design-system/tokens.css` (generated CSS variables, dark + light). Regenerate with `design-system/generate-tokens-css.py`.
- **Components:** guidelines + previews in `design-system/components/` (Button, StatusPill, MatchRing, Diff, CopilotCard, Logo, Cover).
- **Brand:** `brand/orire-mark.svg`, `brand/orire-favicon.svg`.
- **UI/UX spec:** `ui-ux-spec.md` (web + mobile, every screen, OCC model, a11y).
- **Interactive references** (visual + motion source of truth; see `README.md` for links): app/OCC, design system, landing, pages & states, content & emails.

## Principles
1. **Tokens first, then components, then routes.** Nothing hardcodes a hex — everything reads a CSS variable, so theming is free.
2. **No big-bang.** Ship per phase behind the normal review flow; each route migrates independently.
3. **Don't touch output fidelity.** The ATS-safe PDF/DOCX/text export and the invisible-text-layer logic are not part of this redesign — UI only.
4. **Accessibility is a gate, not a polish step** (visible focus, keyboard reorder fallback, `prefers-reduced-motion`, AA contrast in both themes).

---

## Phase 0 — Foundation
- Add `tokens.css` to the global stylesheet; set `data-theme` on `<html>` (default `dark`), with a persisted user toggle.
- Self-host **Bricolage Grotesque** + **Inter**; expose as `--font-display` / `--font-sans`.
- If Tailwind is in use, map `theme.extend.colors` / `spacing` / `borderRadius` to the CSS variables (e.g. `canvas: 'var(--canvas)'`) so utilities and tokens stay in sync.
- **Done when:** any page can use `var(--*)`, the dark/light switch works end to end, and fonts load without layout shift.

## Phase 1 — Core component library
Build in dependency order; each must match its `design-system/components/` preview in both themes, with visible focus and a test/story:
1. Button · Pill/Chip · Card · Toggle
2. Status pill · Toast · Skeleton · Spinner
3. Match ring · Diff block (the trust primitive) · Stepper
4. Chat message + Copilot result card family (one shared `<ResultCard>`)
5. CV paper (template-variant aware) · Command palette · Logo
- **Done when:** components are consumed from one library; no bespoke re-implementations per page.

## Phase 2 — App shell & core surfaces (`/occ`)
- Topbar, sidebar (desktop) / bottom tab bar (mobile), view router, ⌘K palette.
- Surfaces: **OCC conversational**, Home, **Simulate**, **Studio** (Refine · Live edit · Templates), Library, Applications.
- OCC cards render real feature outputs — not chat-only duplicates — over one shared CV/version store.
- **Done when:** feature parity with today's `/occ` in the new look; an action in any surface (incl. a chat card) reflects everywhere.

## Phase 3 — Public & peripheral routes
Re-skin to the new system (designs exist for each):
| Route | Design reference |
|---|---|
| `/` landing | Landing page artifact |
| `/pricing` | Pages & States → Pricing *(set real prices)* |
| `/templates`, `/templates/[id]` | Pages & States → Templates / detail |
| `/cv/[token]` | Pages & States → Shared CV |
| `/magic`, `/forgot`, `/reset`, `/checkout/return` | Pages & States → Auth & checkout |
| `/guides`, `/guides/[slug]` | Content & Emails → Guides / Article |
| `/privacy`, `/terms`, `/support` | Content & Emails → Legal / doc |
| 404 / empty / loading | Pages & States → States |
- **Done when:** every route is responsive, themed, and passes the a11y gate.

## Phase 4 — Transactional emails
- Rebuild as **table-based, inline-styled HTML** for email-client compatibility: light background, system font stack, brand colours only (no web fonts). Templates: magic sign-in link, activation nudge, Pro welcome + receipt (designs in Content & Emails).
- Test across major clients (e.g. Litmus) before swapping the live templates in `src/lib/email`.

## Phase 5 — QA & launch
- Visual QA across all routes (repo already has `docs/visual-qa` + Playwright config); a11y audit; performance (fonts, CLS, bundle).
- **Confirm OCC's production deployment** — `/occ/preview` currently 404s on prod.
- Set real pricing. Then flip.

---

## Pre-launch gaps to close (owner decisions)
- Real **pricing** numbers for `/pricing` and the Pro receipt email.
- Confirm **OCC deployment** status.
- Decide font hosting (self-host recommended).

## Suggested first implementation PR
Phase 0 + the first row of Phase 1 (tokens wired + Button/Card/Pill/Toggle themed), so the foundation is proven on a couple of real screens before the broader migration.
