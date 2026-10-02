/**
 * plateLabels.test.ts
 *
 * Every plate the Earth screen labels has a translated name in every locale, so no
 * label falls back to the dataset's English name.
 */
import { describe, expect, it } from "vitest";
import { PLATES } from "../src/common/data/generated/plateData.js";
import stringsEn from "../src/i18n/strings_en.json";
import stringsEs from "../src/i18n/strings_es.json";
import stringsFr from "../src/i18n/strings_fr.json";

describe("plate labels", () => {
  const majorCodes = PLATES.filter((plate) => plate.major).map((plate) => plate.code);

  it.each([
    ["en", stringsEn],
    ["fr", stringsFr],
    ["es", stringsEs],
  ])("names every major plate in %s", (_locale, strings) => {
    const names: Record<string, string> = strings.plateLabels.names;
    for (const code of majorCodes) {
      expect(names[code], code).toBeTruthy();
    }
  });
});
