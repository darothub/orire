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
    expect(workflow).toMatch(/name: Verify Chromium can launch\n\s*timeout-minutes: 2/);
    expect(workflow).toMatch(/name: Install Playwright Chromium browser\n\s*timeout-minutes: 8/);
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

  it("does not deploy from CI (Vercel Git integration owns deploys)", () => {
    expect(workflow).not.toMatch(/vercel\s+(--prod|pull|deploy)/i);
    expect(workflow).not.toMatch(/npx\s+vercel/i);
    expect(workflow).not.toContain("VERCEL_TOKEN");
  });
});

describe("Bitbucket Pipelines retirement", () => {
  it("no longer ships bitbucket-pipelines.yml", () => {
    expect(existsSync(resolve(root, "bitbucket-pipelines.yml"))).toBe(false);
  });
});
