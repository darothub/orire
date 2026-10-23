# Consent-based conversion measurement (#98)

These are anonymous browser-session milestones, not a count of people or accounts.
Events go to the existing Vercel Web Analytics custom-event destination. No new
endpoint, account data mutation, advertising identifier or analytics vendor is added.

## Events and success definitions

| Event | Trigger | Deduplication | Properties |
| --- | --- | --- | --- |
| `landing_viewed` | Public landing is mounted with analytics consent | Once per browser tab session | None |
| `landing_cta_clicked` | A signup CTA on landing is activated | Once per placement per tab session | `placement`: header, hero, pricing, footer |
| `signup_started` | Signup dialog is visible with consent | Once per tab session | None |
| `signup_completed` (existing) | Authenticated session reports `isNewUser` | Existing local per-account marker, written only with consent | None |
| `template_chosen` | Explicit editor/rebrand template-picker or command-palette template activation | Once per tab session | Catalog template ID only |
| `first_cv_edited` | First changed form control inside the CV editor panel | Once per tab session | None |
| `first_cv_exported` | Authorized PDF/DOCX/TXT export builder succeeds and initiates download | Once per tab session, all formats combined | `format`: pdf, docx, txt |

“First” means the first observed action **in the current tab session after consent**,
not lifetime first use or first saved cloud document. Editor hydration, template
previews loaded automatically, reloading a document, focus, navigation, failed
exports and clipboard copies are not completion. Direct inline preview edits and
AI application are not counted as editor-form edits. Download initiation does not
prove the OS saved a file, the CV was submitted, or an application succeeded.
Signup completion uses the existing short-lived Auth.js new-user signal; it does
not claim email verification or purchase completion. A multi-account browser can
under-count signup activity because of the existing local deduplication marker.

## Privacy and withdrawal

Nothing is sent or queued before affirmative cookie consent, or after Decline or
Cookie preferences withdrawal. Event calls re-read consent even when vendor scripts
remain in memory. The SDK queue and URL sanitizer are initialized only after consent;
its beforeSend callback also rechecks consent at actual dispatch time.
No backfill of earlier CTA/edit/export activity occurs after opting in. A currently
visible landing/signup dialog may be counted on acceptance because it is still visible.
The existing signup marker is no longer consumed before consent.

Only the fixed enums/catalog values above are sent. Never add CV text, filenames,
names, email, document/account/session IDs, job descriptions, tokens, or arbitrary
campaign/query input as properties. SDK URLs have query/fragment data removed and
shared-CV path tokens replaced; API-route telemetry is discarded. These safeguards
apply to Vercel events; existing separate Meta campaign attribution is outside this
funnel and does not receive these new milestones. Existing marketing helpers are
also consent-gated after withdrawal.

Session deduplication uses boolean entries under `orire-funnel:v1:*` in sessionStorage,
with no personal identifiers. If consent/storage cannot be read or the milestone
cannot be persisted, skip it rather than emit undeduplicated data. React effect replay,
repeat clicks and reloads in the same tab do not increase a milestone. New tabs can
count again; blocked scripts, closed tabs, opted-out visitors and privacy tools cause
under-counting. Do not infer unique people or consent rates from event totals.

## Comparing baseline and post-launch

1. In the Vercel project dashboard, use the same environment, consent policy, event
   schema, date-window length, weekday mix and traffic acquisition mix. Exclude test
   and preview environments. Record the release commit and deployment time.
2. Establish a baseline **after this instrumentation is deployed**, before judging a
   later redesign. Historical page views cannot reconstruct missing milestones.
3. Compare consenting-session landing-to-CTA, signup-entry-to-completion and
   editor-to-successful-export rates. CTA placement event sums are not unique sessions;
   do not divide the summed placements by landing views. Signup completion uses a
   different existing per-account dedupe scope, so report it separately, not as an exact
   session funnel ratio. Cross-tab/device continuity and event ordering are not linked.
4. Report sample counts, window boundaries, consent/traffic changes, under-counting
   limits and uncertainty alongside rates. Small samples and different campaigns do
   not establish causation. Prefer a controlled experiment when feasible.
5. A redesign succeeds only if the agreed primary metric improves without worse
   export errors, accessibility regressions or slower page performance. Do not use
   these events as evidence of hiring outcomes or fabricated social proof.

No live dashboard baseline or production conversion improvement was measured by this
PR. Tests use mock SDK calls, fictional input and hermetic export authorization.
