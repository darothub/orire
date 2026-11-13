import { readFileSync } from "node:fs";
import { join } from "node:path";
import nspell from "nspell";
import { setSpellChecker } from "./spell";

/** Install the real dictionary for tests (the browser fetches it instead). */
export function installTestDictionary(): void {
  const dir = join(process.cwd(), "public", "dict");
  setSpellChecker(nspell(readFileSync(join(dir, "en.aff"), "utf8"), readFileSync(join(dir, "en.dic"), "utf8")));
}
