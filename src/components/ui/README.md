# UI primitives (Orire design system)

Token-driven primitives from the Orire design system (`docs/design/design-system/`). This is the first slice of the component library — the foundation the wider redesign builds on.

## Components
- `Button` — `variant` (`primary` | `gold` | `ghost`), `size` (`md` | `sm`), `block`. `gold` is reserved for the match/refine payoff.
- `Card` — surface card; `flat` (no shadow), `pad` (standard padding).
- `Pill` — status pill; `tone` (`saved` | `applied` | `interview` | `offer` | `neutral`), `dot`.
- `Toggle` — controlled `role="switch"`; `tone` (`violet` | `match`).
- `MatchRing` — the signature ring; fills + counts up on mount (`prefers-reduced-motion` aware). `value`, `tone` (`gold` | `match`), `size`, `label`.
- `Diff` — the trust primitive (before → after + reason + accept/reject). `oldText`, `newText`, `why`, `onAccept`, `onReject`.
- `CopilotCard` — the OCC result-card shell: `title`, `icon`, `tag`, `children`, `footer`.
- `ChatMessage` — one OCC thread turn: `role` (`bot` | `user`), `avatar`, `children`.
- `CvPaper` — the CV paper surface; `template` (`modern` | `classic` | `editorial`) with `or-paper__name` / `__role` / `__section` helpers.

Basic primitives are styled in `ui.css`; the composite surfaces (ring, diff, cards, paper) in `surfaces.css`.

`BrandMark` (in `src/components/`) renders the Burst brand mark and keeps its original `size` / `badge` / `className` API.

## Tokens & namespacing
Styling reads the `--or-*` CSS variables defined in `src/styles/orire-tokens.css` (generated from `docs/design/design-system/tokens.json`). They are **namespaced `--or-*` on purpose**: it lets the new design-system tokens coexist with the legacy `--bg` / `--accent` / `--ink` tokens in `globals.css` during migration, with zero collisions. As routes migrate to the new look and the legacy tokens are retired, the prefix can be dropped.

The tokens track the existing `data-theme` attribute (dark default, `html[data-theme="light"]` for light), so these primitives theme automatically with the rest of the app.

## Regenerating tokens
Edit `tokens.json` (the source of truth), then regenerate the app CSS. See `docs/design/implementation-plan.md`.
