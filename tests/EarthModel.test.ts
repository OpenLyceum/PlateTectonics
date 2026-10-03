/**
 * EarthModel.test.ts
 *
 * The screen model: layer visibility, the earthquake depth filter, the choice
 * between the globe and the flat map.
 */

import { describe, expect, it } from "vitest";
import { EarthModel } from "../src/earth/model/EarthModel.js";
import { depthBand, passesDepthFilter } from "../src/earth/model/EarthquakeDepthFilter.js";

describe("EarthModel", () => {
  it("starts with every layer off on the globe", () => {
    const model = new EarthModel();
    expect(model.showPlatesProperty.value).toBe(false);
    expect(model.showGlobeProperty.value).toBe(true);
    expect(model.isFlatMapProperty.value).toBe(false);
    expect(model.showBoundariesProperty.value).toBe(false);
    expect(model.showVectorsProperty.value).toBe(false);
    expect(model.showEarthquakesProperty.value).toBe(false);
    expect(model.showVolcanoesProperty.value).toBe(false);
    expect(model.showTopographyProperty.value).toBe(false);
    expect(model.showSeafloorAgeProperty.value).toBe(false);
    expect(model.earthquakeDepthFilterProperty.value).toBe("all");
  });

  it("shows exactly one of the globe and the flat map", () => {
    const model = new EarthModel();
    const shown = (): string[] =>
      [model.showGlobeProperty.value ? "globe" : null, model.isFlatMapProperty.value ? "flat" : null].filter(
        (name): name is string => name !== null,
      );

    expect(shown()).toEqual(["globe"]);

    model.showGlobeProperty.value = false;
    expect(shown()).toEqual(["flat"]);

    model.showGlobeProperty.value = true;
    expect(shown()).toEqual(["globe"]);
  });

  it("reset() restores every property", () => {
    const model = new EarthModel();
    model.showPlatesProperty.value = true;
    model.showGlobeProperty.value = false;
    model.showBoundariesProperty.value = true;
    model.showVectorsProperty.value = true;
    model.showEarthquakesProperty.value = true;
    model.showVolcanoesProperty.value = true;
    model.showTopographyProperty.value = true;
    model.showSeafloorAgeProperty.value = true;
    model.earthquakeDepthFilterProperty.value = "deep";

    model.reset();

    expect(model.showPlatesProperty.value).toBe(false);
    expect(model.showGlobeProperty.value).toBe(true);
    expect(model.showBoundariesProperty.value).toBe(false);
    expect(model.showVectorsProperty.value).toBe(false);
    expect(model.showEarthquakesProperty.value).toBe(false);
    expect(model.showVolcanoesProperty.value).toBe(false);
    expect(model.showTopographyProperty.value).toBe(false);
    expect(model.showSeafloorAgeProperty.value).toBe(false);
    expect(model.earthquakeDepthFilterProperty.value).toBe("all");
  });
});

describe("earthquake depth bands", () => {
  it("splits at the conventional 70 km and 300 km boundaries", () => {
    expect(depthBand(0)).toBe("shallow");
    expect(depthBand(69.9)).toBe("shallow");
    expect(depthBand(70)).toBe("intermediate");
    expect(depthBand(299)).toBe("intermediate");
    expect(depthBand(300)).toBe("deep");
    expect(depthBand(690)).toBe("deep");
  });

  it("lets everything through the 'all' filter", () => {
    for (const depth of [5, 100, 400]) {
      expect(passesDepthFilter(depth, "all")).toBe(true);
    }
  });

  it("passes only the selected band", () => {
    expect(passesDepthFilter(30, "shallow")).toBe(true);
    expect(passesDepthFilter(150, "shallow")).toBe(false);
    expect(passesDepthFilter(150, "intermediate")).toBe(true);
    expect(passesDepthFilter(500, "intermediate")).toBe(false);
    expect(passesDepthFilter(500, "deep")).toBe(true);
    expect(passesDepthFilter(30, "deep")).toBe(false);
  });
});
