import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guards the Bitbucket → GitHub CI migration intent. These are string/structure
 * assertions on the workflow YAML (no YAML dep needed) so a future edit can't
 * silently drop a required check or re-introduce a token-based Vercel deploy
 * (deploys now run through Vercel's native GitHub integration).
 */
const root = process.cwd();
const workflowPath = resolve(root, ".github/workflows/ci.yml");
const workflow = existsSync(workflowPath) ? readFileSync(workflowPath, "utf8") : "";

/** Locate a named workflow step without depending on YAML property order. */
function stepBlock(yaml: string, name: string): string {
  const blocks = yaml.split(/(?=^      - (?:name:|uses:|run:))/m);
  const block = blocks.find((part) => part.startsWith("      - name: " + name + "\n"));
  if (!block) throw new Error("Missing workflow step: " + name);
  return block;
}
describe("GitHub Actions CI workflow", () => {
  it("exists at .github/workflows/ci.yml", () => {
    expect(existsSync(workflowPath)).toBe(true);
  });

  it("triggers on pull requests and pushes to main", () => {
    expect(workflow).toMatch(/pull_request:/);
    expect(workflow).toMatch(/push:\s*\n\s*branches:\s*\[main\]/);
  });

  it("runs lint, typegen, typecheck and unit tests", () => {
    expect(workflow).toContain("npm run lint");
    expect(workflow).toContain("npx next typegen");
    expect(workflow).toContain("npx tsc --noEmit");
    expect(workflow).toContain("npm test");
  });

  it("runs a production build and the Playwright e2e suite", () => {
    expect(workflow).toContain("npm run build");
    expect(workflow).toContain("npm run test:e2e");
    expect(workflow).not.toMatch(/^\s*run:\s*npx playwright install-deps chromium\s*$/m);
    expect(workflow).toContain("playwright install chromium");
    expect(workflow).not.toContain("playwright install --with-deps chromium");
    expect(stepBlock(workflow, "Verify Chromium can launch")).toMatch(/^\s*timeout-minutes: 2$/m);
    expect(stepBlock(workflow, "Install Playwright Chromium browser")).toMatch(/^\s*timeout-minutes: 8$/m);
    expect(workflow).toContain("name: Run full Playwright regression");
    expect(workflow).toContain("npx playwright test --grep '@smoke'");
  });

  it("runs independent E2E checks in parallel and caches Next builds", () => {
    const e2e = workflow.split("\n  e2e:\n")[1];
    expect(e2e).toBeDefined();
    expect(e2e).not.toMatch(/^\s*needs:/m);
    expect(e2e).toContain('E2E_PREBUILT: "1"');
    expect(e2e).toContain("name: Cache Next.js incremental build data");
    expect(e2e).toContain("path: .next/cache");
    expect(e2e).toContain("name: Build once for browser tests");
    expect(e2e).toContain("name: Record build elapsed time");
    expect(e2e).toContain("Choose PR smoke or full regression");
  });

  it("selects full regression when shared fixtures or any E2E spec changes", () => {
    const selection = stepBlock(workflow, "Choose PR smoke or full regression");
    const expression = selection.match(/grep -Eq '([^']+)'/);
    expect(expression).not.toBeNull();
    const fullSuite = new RegExp(expression![1]);
    for (const path of ["e2e/fixtures.ts", "e2e/session.ts", "e2e/database.ts", "e2e/onboarding-tour-a11y.spec.ts", "playwright.config.ts"]) {
      expect(fullSuite.test(path), path).toBe(true);
    }
    expect(fullSuite.test("src/lib/content/guides.ts")).toBe(false);
  });

  it("preserves the required E2E job for documentation-only PRs", () => {
    expect(workflow).toContain("name: Classify documentation-only PR");
    expect(workflow).toContain("id: docs");
    expect(workflow).toContain("git diff --name-only");
    expect(workflow).toContain("steps.docs.outputs.skip != 'true'");
    expect(workflow).not.toContain("paths-ignore:");
    expect(workflow).toContain("name: Run full Playwright regression");
  });

  it("does not deploy from CI (Vercel Git integration owns deploys)", () => {
    expect(workflow).not.toMatch(/vercel\s+(--prod|pull|deploy)/i);
    expect(workflow).not.toMatch(/npx\s+vercel/i);
    expect(workflow).not.toContain("VERCEL_TOKEN");
  });
});

describe("Workflow step parsing", () => {
  it("accepts step properties in any order and extra conditions", () => {
    const fixture = [
      "      - name: Verify Chromium can launch",
      "        timeout-minutes: 2",
      "        env:",
      "          CI: true",
      "        if: steps.docs.outputs.skip != true",
      "        run: echo launched",
      "      - name: Run full Playwright regression",
      "        run: npm run test:e2e",
    ].join("\n");
    expect(stepBlock(fixture, "Verify Chromium can launch")).toMatch(/^\s*timeout-minutes: 2$/m);
    expect(stepBlock(fixture, "Verify Chromium can launch")).toContain("steps.docs.outputs.skip");
    expect(stepBlock(fixture, "Verify Chromium can launch")).not.toContain("Run full Playwright regression");
  });
});
describe("Bitbucket Pipelines retirement", () => {
  it("no longer ships bitbucket-pipelines.yml", () => {
    expect(existsSync(resolve(root, "bitbucket-pipelines.yml"))).toBe(false);
  });
});
