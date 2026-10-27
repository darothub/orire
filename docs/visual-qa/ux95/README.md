# UX95 — confirmed policy and contact information

Owner decisions, 27 October 2026: Bogini; Porto, Portugal (public location, not a registered-office street address); Instagram @orire.app for support and initial privacy enquiries; OpenAI and Anthropic; adopt existing account/CV 30-day, billing 10-year and log 90-day retention policy. The case-by-case refund draft is **not approved for publication**. Terms section 5 remains byte-for-byte unchanged.

## BEFORE — actual Orire render

Baseline `f0fdedd74ea811558f1e988c140c817ba24ae9f8`, isolated local production build. `before-provenance.json` records build, Chromium, viewports, themes, HTTP status, errors and source hashes. The baseline hashes match Git source.

[Desktop privacy](before-actual-privacy-desktop-dark.png) · [Mobile privacy](before-actual-privacy-mobile-light.png) · [Desktop support](before-actual-support-desktop-dark.png) · [Mobile support](before-actual-support-mobile-light.png)

## Approved content

The owner supplied and approved the identity, public location, retention policy, providers and initial Instagram contacts in the task before implementation. This is a factual copy/link update using existing page structure and styling, not a new visual design. No proposed mockup is represented as an implemented screenshot. Local production-build visual evidence was authorized for this batch.

## AFTER — implemented screenshot

`after-provenance.json` identifies the tested production source and source hashes. Twelve full-page captures cover Privacy, Terms and Support at 1440×900 and 390×844 in both themes. External requests were blocked; no Instagram message, real support submission, provider call or payment was made.

[Desktop privacy](after-actual-privacy-desktop-dark.png) · [Mobile privacy](after-actual-privacy-mobile-light.png) · [Desktop support](after-actual-support-desktop-dark.png) · [Mobile support](after-actual-support-mobile-light.png) · [Desktop terms](after-actual-terms-desktop-dark.png) · [Mobile terms](after-actual-terms-mobile-light.png)

## Source-backed behavior

- `src/app/api/parse/route.ts`: original uploads parsed without persistence in this handler; extracted content can feed AI features.
- `src/components/auth/CloudSync.tsx`: signed-in edits autosave; Library versions are additional saved records.
- `src/lib/ai/server/providerRouter.ts` and `responseCache.ts`: provider routing/failover and temporary response caching.
- `src/app/actions/account.ts`: verified-account JSON export excludes secrets and external provider records; deletion removes active database records and attempts Stripe cancellation.
- `src/lib/store/applyStorageScope.ts`: sign-out changes account storage scope; it does not erase all prior browser copies.
- Existing support mail transport remains; its default inbox is not presented as an owner-verified public contact. Failure copy directs users to Instagram.

## Verification and limits

Exact required commands, exit codes and timestamps are recorded in `verification.json`. Tests use only disposable loopback PostgreSQL. Fifteen new browser cases cover contact URLs, policy content, footer keyboard navigation, responsive overflow and axe across pages/themes/viewports. Existing support form regression remains enabled.

The first typecheck caught an obsolete privacy-email reference; corrected before the full rerun. No assertions were weakened, timeouts increased or tests disabled.

Retention values are owner-adopted policy, not an audit of scheduled deletion jobs. Backup/support-message retention, provider agreements/settings, live email delivery and Instagram message delivery were not independently verified. No compliance certification or full registered-office address is claimed. The unapproved refund draft is excluded.

Official references reviewed 27 October 2026:
- [European Commission: ODR closure and current redress directory](https://consumer-redress.ec.europa.eu/site-relocation_en)
- [OpenAI commercial data defaults](https://openai.com/business-data/)
- [Anthropic commercial data defaults](https://support.anthropic.com/en/articles/11174108-about-the-development-partner-program)

Final local result: lint (one pre-existing unused `ProviderId` warning), Next type generation, TypeScript, 562 unit tests in 81 files, production build, and full Playwright all exited 0. Playwright: **170 passed, one unchanged mobile export skip, no retries, 1.5 minutes**. All 12 after captures returned HTTP 200 with zero page errors; the 12 route/theme/viewport axe checks found zero violations. Desktop dark Privacy and mobile light Support were visually inspected for text flow/clipping. No styles or layout components changed.
