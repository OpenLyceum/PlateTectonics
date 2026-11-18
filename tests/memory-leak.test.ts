/**
 * Fleet-standard memory-leak regression suite (SceneryStackTemplate / QubitSketch pattern).
 *
 * Creates a disposable model object inside a function boundary, disposes it, forces
 * garbage collection via global.gc (--expose-gc in vitest.config.ts), then asserts via
 * WeakRef that the object was collected. V8 requires a function boundary (not merely
 * a block scope) so local strong references die when the helper returns.
 */

import type { TReadOnlyProperty } from "scenerystack/axon";
import { Bounds2, Vector2 } from "scenerystack/dot";
import { describe, expect, it } from "vitest";
import { CrossSectionScale } from "../src/common/model/CrossSectionScale.js";
import { SectionViewModel } from "../src/common/model/SectionViewModel.js";
import { PlateReconstruction } from "../src/common/PlateReconstruction.js";
import { TimeModel } from "../src/common/TimeModel.js";
import { RangeLabelNode } from "../src/common/view/RangeLabelNode.js";
import { flatPlacement } from "../src/common/view/SectionPlacement.js";
import { CrustModel } from "../src/crust/model/CrustModel.js";
import { CrustLabelsNode } from "../src/crust/view/CrustLabelsNode.js";
import { EarthModel } from "../src/earth/model/EarthModel.js";
import { StringManager } from "../src/i18n/StringManager.js";
import PlateTectonicsColors from "../src/PlateTectonicsColors.js";
import { PLATE_X_LIMIT_M, SECTION_VIEW_BOUNDS } from "../src/PlateTectonicsConstants.js";
import { PlateMotionModel } from "../src/plate-motion/model/PlateMotionModel.js";
import { PlateMotionLabelsNode } from "../src/plate-motion/view/PlateMotionLabelsNode.js";
import { describeDisposalLeaks, forceGC } from "./helpers/memoryLeak.js";

function createAndDisposeTimeModel(): WeakRef<object> {
  const model = new TimeModel();
  const ref = new WeakRef<object>(model);
  model.dispose();
  return ref;
}

/**
 * Each Earth canvas holds a transform with a matrix per motion frame. It must be
 * collectable when its owning view is discarded.
 */
function createAndDropReconstruction(): WeakRef<object> {
  const reconstruction = new PlateReconstruction();
  reconstruction.transform(-71.5, -21.5, 0);
  return new WeakRef<object>(reconstruction);
}

/**
 * A screen model is created afresh every time its screen is first shown, and holds
 * DerivedProperties that link to its own Properties. Those links are exactly the kind
 * of cycle that keeps a discarded model alive, so each screen model gets an entry here.
 */
function createAndDisposeCrustModel(): WeakRef<object> {
  const model = new CrustModel();
  const ref = new WeakRef<object>(model);
  model.step(1 / 60);
  model.reset();
  model.dispose();
  return ref;
}

function createAndDisposePlateMotionModel(): WeakRef<object> {
  const model = new PlateMotionModel();
  const ref = new WeakRef<object>(model);
  model.setPlate("left", "continental");
  model.setPlate("right", "oldOceanic");
  model.motionTypeProperty.value = "convergent";
  model.step(1 / 60);
  model.reset();
  model.dispose();
  return ref;
}

function createAndDisposeEarthModel(): WeakRef<object> {
  const model = new EarthModel();
  const ref = new WeakRef<object>(model);
  model.step(1 / 60);
  model.reset();
  model.dispose();
  return ref;
}

describe("Memory leak regression", () => {
  it("TimeModel is collected after dispose", async () => {
    const ref = createAndDisposeTimeModel();
    await forceGC(ref);
    expect(ref.deref()).toBeUndefined();
  });

  it("double dispose() does not throw", () => {
    const model = new TimeModel();
    model.dispose();
    expect(() => model.dispose()).not.toThrow();
  });

  it("PlateReconstruction is collected once dropped", async () => {
    const ref = createAndDropReconstruction();
    await forceGC(ref);
    expect(ref.deref()).toBeUndefined();
  });

  it("repeated reconstructions leave no survivors", async () => {
    const refs: WeakRef<object>[] = [];
    for (let i = 0; i < 10; i++) {
      refs.push(createAndDropReconstruction());
    }
    await forceGC(refs);
    expect(refs.filter((ref) => ref.deref() !== undefined).length).toBe(0);
  });

  it("CrustModel is collected once disposed", async () => {
    const ref = createAndDisposeCrustModel();
    await forceGC(ref);
    expect(ref.deref()).toBeUndefined();
  });

  it("repeated CrustModel cycles leave no survivors", async () => {
    const refs: WeakRef<object>[] = [];
    for (let i = 0; i < 10; i++) {
      refs.push(createAndDisposeCrustModel());
    }
    await forceGC(refs);
    expect(refs.filter((ref) => ref.deref() !== undefined).length).toBe(0);
  });

  it("PlateMotionModel is collected once disposed", async () => {
    const ref = createAndDisposePlateMotionModel();
    await forceGC(ref);
    expect(ref.deref()).toBeUndefined();
  });

  it("repeated PlateMotionModel cycles leave no survivors", async () => {
    const refs: WeakRef<object>[] = [];
    for (let i = 0; i < 10; i++) {
      refs.push(createAndDisposePlateMotionModel());
    }
    await forceGC(refs);
    expect(refs.filter((ref) => ref.deref() !== undefined).length).toBe(0);
  });

  it("EarthModel is collected once disposed", async () => {
    const ref = createAndDisposeEarthModel();
    await forceGC(ref);
    expect(ref.deref()).toBeUndefined();
  });

  it("repeated EarthModel cycles leave no survivors", async () => {
    const refs: WeakRef<object>[] = [];
    for (let i = 0; i < 10; i++) {
      refs.push(createAndDisposeEarthModel());
    }
    await forceGC(refs);
    expect(refs.filter((ref) => ref.deref() !== undefined).length).toBe(0);
  });

  it("repeated create/dispose cycles leave no survivors", async () => {
    const refs: WeakRef<object>[] = [];
    for (let i = 0; i < 10; i++) {
      refs.push(createAndDisposeTimeModel());
    }
    await forceGC(refs);
    const survivors = refs.filter((r) => r.deref() !== undefined).length;
    expect(survivors).toBe(0);
  });
});

/** Axon re-declares getListenerCount() private on ReadOnlyProperty; the cast is deliberate. */
function listenerCount(property: TReadOnlyProperty<unknown>): number {
  return (property as unknown as { getListenerCount(): number }).getListenerCount();
}

describe("CrustLabelsNode releases the labels it rebuilds", () => {
  it("rebuilds and dispose leave the sim-lifetime string and color Properties as they were", () => {
    const section = StringManager.getInstance().getSectionStrings();
    const watched: readonly TReadOnlyProperty<unknown>[] = [
      section.seaLevelStringProperty,
      section.crustStringProperty,
      section.oceanicCrustStringProperty,
      PlateTectonicsColors.textColorProperty,
      PlateTectonicsColors.secondaryTextColorProperty,
    ];
    const bounds = new Bounds2(
      SECTION_VIEW_BOUNDS.minX,
      SECTION_VIEW_BOUNDS.minY,
      SECTION_VIEW_BOUNDS.maxX,
      SECTION_VIEW_BOUNDS.maxY,
    );
    const placement = flatPlacement(
      new CrossSectionScale({
        bounds,
        halfWidthM: 700000,
        topM: 16000,
        bottomM: -300000,
        bandBottomM: -20000,
        bandHeightFraction: 0.3,
      }),
    );
    const model = new CrustModel();
    const before = watched.map(listenerCount);

    const node = new CrustLabelsNode(model, placement, bounds);
    const built = watched.map(listenerCount);
    expect(built.some((count, index) => count > (before[index] ?? 0))).toBe(true);

    // Each rebuild must replace the labels, not pile new subscribers on top of the old.
    for (let i = 0; i < 5; i++) {
      model.crustThicknessProperty.value += 1000;
      node.setPlacement(placement);
    }
    expect(watched.map(listenerCount)).toEqual(built);

    model.showLabelsProperty.value = false;
    expect(watched.map(listenerCount)).toEqual(before);
    model.showLabelsProperty.value = true;

    node.dispose();
    expect(watched.map(listenerCount)).toEqual(before);
    model.dispose();
  });
});

describe("PlateMotionLabelsNode releases the labels it rebuilds", () => {
  it("rebuilds and dispose leave the sim-lifetime string and color Properties as they were", () => {
    const section = StringManager.getInstance().getSectionStrings();
    const motion = StringManager.getInstance().getPlateMotionStrings();
    const a11y = StringManager.getInstance().getPlateMotionA11yStrings().controls;
    const watched: readonly TReadOnlyProperty<unknown>[] = [
      section.lithosphereStringProperty,
      section.mantleStringProperty,
      motion.continentalCrustLabelStringProperty,
      motion.oldOceanicCrustLabelStringProperty,
      motion.ridgeStringProperty,
      motion.dropRightStringProperty,
      a11y.leftDropZoneStringProperty,
      a11y.rightDropZoneHelpStringProperty,
      PlateTectonicsColors.textColorProperty,
      PlateTectonicsColors.secondaryTextColorProperty,
      PlateTectonicsColors.dropZoneColorProperty,
      PlateTectonicsColors.dropZoneActiveColorProperty,
      PlateTectonicsColors.panelBackgroundColorProperty,
    ];
    const bounds = new Bounds2(
      SECTION_VIEW_BOUNDS.minX,
      SECTION_VIEW_BOUNDS.minY,
      SECTION_VIEW_BOUNDS.maxX,
      SECTION_VIEW_BOUNDS.maxY,
    );
    const placement = flatPlacement(
      new CrossSectionScale({
        bounds,
        halfWidthM: PLATE_X_LIMIT_M,
        topM: 16000,
        bottomM: -300000,
        bandBottomM: -20000,
        bandHeightFraction: 0.3,
      }),
    );
    const model = new PlateMotionModel();
    const before = watched.map(listenerCount);

    // One plate down and a piece in hand: both zones are dressed, the empty one with its
    // instruction on a backing.
    model.setPlate("left", "continental");
    model.armedPlateTypeProperty.value = "oldOceanic";
    const node = new PlateMotionLabelsNode(model, placement, bounds);
    const zonesBuilt = watched.map(listenerCount);
    expect(zonesBuilt.some((count, index) => count > (before[index] ?? 0))).toBe(true);
    for (const side of ["left", "right", null, "right", null] as const) {
      node.setHoveredZone(side);
    }
    expect(watched.map(listenerCount)).toEqual(zonesBuilt);

    // Both plates and a running boundary: the range labels, base lines and feature names,
    // rebuilt on every tick of the clock.
    model.activateZone("right");
    model.motionTypeProperty.value = "divergent";
    model.timeMillionsOfYearsProperty.value = 1;
    const labelsBuilt = watched.map(listenerCount);
    for (let i = 2; i < 8; i++) {
      model.timeMillionsOfYearsProperty.value = i;
      node.setPlacement(placement);
    }
    expect(watched.map(listenerCount)).toEqual(labelsBuilt);

    node.dispose();
    expect(watched.map(listenerCount)).toEqual(before);
    model.dispose();
  });
});

describe("RangeLabelNode releases its own parts", () => {
  it("a plain dispose() leaves the label's string and color Properties as they were", () => {
    const section = StringManager.getInstance().getSectionStrings();
    const watched: readonly TReadOnlyProperty<unknown>[] = [
      section.lithosphereStringProperty,
      PlateTectonicsColors.textColorProperty,
    ];
    const bounds = new Bounds2(
      SECTION_VIEW_BOUNDS.minX,
      SECTION_VIEW_BOUNDS.minY,
      SECTION_VIEW_BOUNDS.maxX,
      SECTION_VIEW_BOUNDS.maxY,
    );
    const placement = flatPlacement(
      new CrossSectionScale({
        bounds,
        halfWidthM: PLATE_X_LIMIT_M,
        topM: 16000,
        bottomM: -300000,
        bandBottomM: -20000,
        bandHeightFraction: 0.3,
      }),
    );
    const before = watched.map(listenerCount);

    // Both styles: the extent proper, and the collapsed one with a leader line.
    for (const bottomM of [-100000, -500]) {
      const label = new RangeLabelNode({
        placement,
        topM: new Vector2(0, 0),
        bottomM: new Vector2(0, bottomM),
        label: section.lithosphereStringProperty,
        viewBounds: bounds,
      });
      expect(label.layout.collapsed).toBe(bottomM === -500);
      expect(watched.map(listenerCount).some((count, index) => count > (before[index] ?? 0))).toBe(true);
      label.dispose();
      expect(watched.map(listenerCount)).toEqual(before);
    }
  });
});

describeDisposalLeaks([
  { name: "CrustModel", create: () => new CrustModel() },
  { name: "PlateMotionModel", create: () => new PlateMotionModel() },
  { name: "EarthModel", create: () => new EarthModel() },
  { name: "TimeModel", create: () => new TimeModel(), idempotentDispose: true },
  { name: "SectionViewModel", create: () => new SectionViewModel() },
]);
