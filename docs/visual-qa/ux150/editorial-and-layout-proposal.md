# Three Orire guide redesigns — editorial and layout proposal

**Status: proposed, not implemented.** The existing routes still show outline placeholders. Actual before and proposed after screenshots from *each named route* (desktop 1440×900 and mobile 390×844) and explicit owner approval are mandatory before modifying rendered UI.

## Shared design direction

Use the already implemented "How to choose the right CV template" guide as visual reference: Orire typography, graphite/emerald palette, responsive spacing, real CV template imagery, restrained motion, clear active states, accessibility and useful navigation. Avoid generic blog templates, unverifiable ATS promises and invented user testimonials.

Proposed page hierarchy:
1. Back to all guides, topic eyebrow, short meaningful H1 and two-sentence lede.
2. Plain-language key takeaway and practical checklist.
3. Numbered sections with real before/after CV examples where appropriate.
4. Accessible related guides and a "Create your CV" CTA.
5. Mobile single-column composition; avoid horizontal scrolling.

## 1. How to tailor your CV to a job description

**Takeaway:** Make the most relevant *true* experience easier to find. Tailoring is not rewriting your career history.

**Step 1 — Extract what the role asks for.** Read the job description and underline qualifications, responsibilities, and tools. Split the requirements into must-have and helpful-to-have. For each, mark whether you have strong evidence, partial experience, or no direct experience. Do not claim a tool just because it appears in the advert.

**Step 2 — Build an evidence map.** Match each supported requirement to a project, achievement or responsibility you actually handled. An employer asking for reliability engineering might connect to an incident-response improvement, a deployment change or monitoring work—not simply adding “reliability” to a skills list.

**Step 3 — Put relevant proof first.** Tailor the summary, choose your most relevant accomplishments, and reorder bullets within each role when chronology stays clear. Keep job titles, dates and credentials factually accurate.

**Step 4 — Use recognizable wording.** If the advert says “PostgreSQL” and you used PostgreSQL, say so. Prefer normal language over keyword stuffing and never paste a list of unearned skills.

**Step 5 — Verify the finished document.** Confirm it is readable, succinct, and accurate; export a text-selectable PDF or a Word file as required by the application. Re-read the job posting for submission requirements.

**Example (illustrative, not a claim about any user):**
Before: “Responsible for deployment processes.”
After, *only if documented*: “Automated the release checklist for the payments service, reducing manual deployment steps from 12 to 4.”

## 2. How to quantify achievements on your CV

**Takeaway:** Specific evidence helps recruiters understand the scale and consequence of your work. Never make up a number for impact.

**Step 1 — Start with the action.** Identify what you personally changed, built, improved, resolved or delivered.

**Step 2 — Find a verifiable measure.** Look for team size, customer volume, requests handled, time saved, incident counts, cycle time, error rate, budget, delivery frequency or performance changes. Check dashboards, project notes and approved reports rather than guessing.

**Step 3 — Add context and outcome.** Use “Action + scope + result”: describe what you did, what it affected, and the observed result. Distinguish a team outcome from an individual contribution.

**Before/after (illustrative):**
Before: “Worked on customer service performance.”
After, *only when evidence exists*: “Redesigned the issue-triage workflow for a six-person support team and reduced median first-response time from 10 hours to 6.”

**When exact metrics are unavailable:** Honest scope still helps: “Led weekly release coordination across three teams” is stronger than “Helped manage releases.” A clear qualitative outcome, such as improving incident handoffs, is preferable to an invented percentage.

**Review:** Check dates, units, baselines and attribution. Avoid presenting estimates as audited outcomes; if approximations are supported, label them as approximate.

## 3. How to get your CV past an ATS

**Takeaway:** There is no universal secret ATS score or guaranteed way to “beat” applicant tracking systems. Make your CV easy to parse and relevant to the role.

**Step 1 — Use recognizable sections.** Common headings such as Experience, Education and Skills make the document easier for both people and software to navigate. Put essential contact details in ordinary text.

**Step 2 — Prefer readable document structure.** Make sure text is selectable and meaningful in reading order. Avoid baking the whole CV into a single picture. Complex columns, tables, headers, icons and unusual fonts may behave differently among parsing systems; check the actual exported file.

**Step 3 — Use truthful keywords naturally.** Include exact names for tools, qualifications and methods you really know, in the context of accomplishments or skills. Hidden text, repeated lists and copied job adverts are poor substitutes for evidence.

**Step 4 — Check the export.** Follow the employer's requested PDF or DOCX format. Open the file, copy a paragraph into plain text and verify that words and dates come out in a sensible order. Use a clear filename, such as `First_Last_CV.pdf`.

**Step 5 — Keep the human reader in mind.** An ATS may parse or filter applications, but the CV must still explain your experience to a recruiter. Clarity, relevance and honesty matter more than gaming a speculative score.

## Implementation boundaries

- Reuse existing legitimate design patterns; do not redesign navigation globally from this workstream.
- Preserve correct `noindex` until a guide is genuinely complete.
- Validate copy and accessibility before switching `PUBLISHED_GUIDE_SLUGS`.
- Attach actual before/proposal/after screenshots, not unrelated template screenshots.
- Completion PR: `Fixes #150` only when all three actual pages are implemented, verified and screenshot-approved.
