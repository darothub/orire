## GitHub issue closure

Closes: Fixes #<!-- issue number, ONLY when ALL acceptance criteria are fulfilled -->

> GitHub automatically closes an issue when a PR containing `Fixes #123` is merged into the default branch. Replace the placeholder with a real issue number. If acceptance criteria remain incomplete, **remove the Fixes line** and use `Refs #123` instead.

### Acceptance criteria satisfied
- [ ] List each acceptance criterion from the linked issue with concrete implementation/evidence
- [ ] No known unmet criteria for the issue being closed
- [ ] Previous related PRs were reviewed to avoid duplicating completed work

### Verification
- [ ] Appropriate unit tests and lint/typecheck/build ran successfully (provide GitHub Actions link)
- [ ] Relevant E2E tests passed (provide GitHub Actions link)
- [ ] Browser/manual checks and limitations described accurately
- [ ] Screenshots of actual desktop and mobile app attached when the changes affect UI
- [ ] Proposed visual changes were explicitly approved against authentic Orire screenshots before implementation

### Risk and scope
- Describe the product behavior changed, known limitations, and any other open issue dependencies.
- Confirm no customer data, real payment, production credential, or unapproved deployment changes.

**Do not merge automatically. The owner reviews and merges.**
