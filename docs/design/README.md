# Orire — Design

The visual and UX source of truth for the Orire app and the Orire Career Copilot (OCC). Built around **"Ink + Fortune"**: a warm violet-ink canvas, **violet** for the copilot/AI, and **gold** reserved for the match/success payoff (*orire* = good fortune in Yoruba).

## Contents

- **[`ui-ux-spec.md`](./ui-ux-spec.md)** — the build-ready UI/UX specification. Product model (Orire + OCC), layout system, every screen in **web and mobile** layouts, the OCC intent→card mapping, feature specs (Simulate, Refine, Live edit, Templates), interaction/motion, and the accessibility floor.
- **[`design-system/`](./design-system/)** — the design system source:
  - `tokens.json` — the authoritative tokens: colors (dark + light themes), type scale, spacing, radius, shadow. Each with a usage note. **Consume this for CSS variables.**
  - `README.md` — the brand book (voice, color usage rules, component overview).
  - `components/<Name>/` — per-component guidelines (`README.md`) + live preview (`preview.html`): Button, StatusPill, MatchRing, Diff, CopilotCard, Logo, Cover.
  - `bundle.css` — component styles consumed by the previews.
- **[`brand/`](./brand/)** — the brand mark (the **Burst**: gold axes + violet diagonals):
  - `orire-mark.svg` — full-colour mark.
  - `orire-favicon.svg` — gold-only, legible ≤ 20px (favicon / app icon).

## Brand quick reference

- **Colours:** gold `#F5C56B` / violet `#8273F6` (dark-theme brand values). On light surfaces use the light-theme gold `#C78A1E` for contrast, or go one-ink.
- **Type:** Bricolage Grotesque (display, 800 for the wordmark, tracking −0.03em) + Inter (UI/body). Both Google-hosted; self-host for production.
- **Favicon rule:** below ~20px drop the violet diagonals — use `orire-favicon.svg`.

## Interactive reference prototypes

These are the visual + motion source of truth (hosted Claude artifacts; treat as reference, not architecture):

- **App / OCC prototype** — https://claude.ai/artifact/2DLw7n8qsN5yutZcJuvyxD
- **Design system** — https://claude.ai/artifact/7NYzcPJ1qu5q2UVeRRWRD9
- **Landing page** — https://claude.ai/artifact/NE2x9GB3n4sLe658PtDoax

## How to consume

1. Read `ui-ux-spec.md` for what to build and how it should behave.
2. Pull exact values from `design-system/tokens.json` → emit as CSS custom properties under `[data-theme]`.
3. Mirror the component guidelines in `design-system/components/` when building React components.
