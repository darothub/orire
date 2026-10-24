# UX88 — Orire UI consistency contract (proposed; no visual changes)

## Existing design language

Orire's production tokens in `src/app/globals.css` already define graphite background and neutral panels (`--bg`, `--panel`, `--panel-2`), emerald actions (`--accent`, `--accent-2`, `--grad`), text hierarchy (`--text`, `--muted`, `--faint`), borders (`--line`, `--line-2`) and a shared corner radius (`--radius`). The exported CV paper uses separate `--paper`/`--ink` tokens and MUST NOT be restyled by workspace changes.

## Proposed scale to apply *after* actual screenshot approval

| Semantic role | Desktop | Mobile | Constraints |
| --- | --- | --- | --- |
| Display/hero | `clamp(32px, 5vw, 56px)` | inherits clamp | 1.08–1.14 line-height |
| Section heading | `clamp(25px, 3vw, 36px)` | inherits clamp | no all-caps multiline headings |
| Card heading | `18–22px` | `17–20px` | descriptive, one H hierarchy |
| Body | `15–17px` | `15–17px` | ≥1.5 line-height |
| Supporting label | `12–14px` | `12–14px` | never rely on color alone |
| Small/medium/large spacing | `8/16/24px` | same | use existing rhythm first |
| Section separation | `48–72px` | `32–52px` | avoid mobile excess |
| Interactive target | ≥44×44px | ≥44×44px | focus ring visible in both themes |
| Panel/card corners | 14–18px | 14–18px | outer heroes may use 22–24px |

## Visual acceptance before production CSS edits
1. Capture genuine desktop 1440×900 and mobile 390×844 screenshots of landing, signup and Studio in the current build. Use fictional CV data.
2. Make before/after proposals derived from these exact Orire captures. Include both light and dark theme contrast samples for primary/secondary buttons.
3. Request explicit approval for the visual proposals; this document is NOT that approval, nor a screenshot.
4. Implement small shared CTA/focus/spacing fixes in an approved feature PR; preserve CV paper tokens and export layout.
5. Capture genuine implemented-after screenshots, confirm contrast/focus/keyboard/regression and only then use `Fixes #88`.

## Known risks
Changing global `h1`, `h2`, `button` or `.paper` rules would affect public pages and exported CVs unexpectedly. Scope changes to the app shell and public components, not the printed CV.
