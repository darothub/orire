# Orire — design system

Orire is an AI CV studio, and **OCC (Orire Career Copilot)** is its conversational layer — every Orire feature (tailor, simulate, template, edit, export) reachable by chat. This system is the shared visual language for both. It pairs with the UI/UX spec (`claude/orire-occ-ui-ux-spec.md`) and the interactive reference prototype.

## Idea: "Ink + Fortune"

*Orire* is Yoruba for **good fortune**. The whole system turns on one emotional beat — the **match moment**, when a candidate sees they fit a role. So the palette is deliberate: a warm **violet-ink** canvas (not near-black, not cream), **violet** for the copilot and every primary action, and **gold** held back for one job only — *match, success, achievement*. Cool-AI meets warm-fortune. Spend gold sparingly and it stays meaningful; spread it around and the system loses its point.

## Voice

- Plain, active, confident. A button says what happens: "Simulate the gap", "Refine for Stripe", "Accept change".
- An action keeps its name through the whole flow — "Publish" → "Published".
- Grounding is a feature: anywhere AI writes CV content, say "fact-grounded — nothing invented".
- No hype, no exclamation marks, no emoji in product UI.

## Using the tokens

- **Color** — semantic tokens with a `dark` (primary) and `light` theme; the first theme is the fallback. Status is **never** carried by color alone — always a label or icon too. `violet` = primary/AI, `gold` = the match payoff, `match` (green) = resolved/strong, `gap` (coral) = missing/at-risk.
- **Type** — two families, clearly distinct: **Bricolage Grotesque** (display, big numbers, match %) and **Inter** (UI/body). Numbers use tabular figures. No all-caps labels, no single-word accent coloring. Both are Google-hosted; load them where you render.
- **Space / radius** — a 4pt spacing scale and a five-step radius scale. Match radius to element size: chips `radius-sm`, buttons `radius-md`, cards `radius-lg`, hero surfaces `radius-xl`. Never one radius on everything.
- **Elevation** — two shadows only (`shadow-soft` resting, `shadow` for paper/popovers). In dark mode prefer borders over shadows.

## Components

Live previews included: **Button** (primary / gold / ghost), **Status pill** (Saved / Applied / Interview / Offer), **Match ring** (the signature reveal), **Diff** (the fact-grounded trust primitive, reused by Refine and the quality coach), and **Copilot card** (how OCC renders a feature result inline). Each preview reads from the tokens, so recoloring the system recolors every component.

## Motion & accessibility (floor)

- One orchestrated reveal — the match ring filling — plus motion that answers an action (view switch, diff accept, message enter). No fade-up on every card. Respect `prefers-reduced-motion`.
- Visible keyboard focus everywhere (2px violet, 2px offset). Text meets WCAG AA in both themes. Drag-reorder always has a keyboard move-earlier/later fallback with ARIA position announcements.

## What a consumer provides

The app supplies the fonts (Bricolage Grotesque + Inter), the theme attribute (`data-theme="dark|light"`), and React 18 for interactive components. This system supplies the tokens, the component styles/markup, and the usage rules.
