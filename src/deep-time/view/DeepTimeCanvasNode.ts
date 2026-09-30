/**
 * DeepTimeCanvasNode.ts
 *
 * The reconstructed Earth, painted onto a rotatable globe.
 *
 * ── The two halves, drawn together ────────────────────────────────────────────
 * This screen draws data of two different kinds at once, and the difference is
 * visible if you look for it:
 *
 *  - The **continents** are present-day coastlines carried by an interpolated
 *    rotation, so they move *continuously* — dragging the time slider glides them.
 *  - The **plates and boundaries** are resolved topologies, baked every 5 Myr, so
 *    they *step*. A ridge appears between one snapshot and the next rather than
 *    growing.
 *
 * That is not an oversight; it falls out of what the data can be. A coastline has
 * present-day geometry to rotate. A plate polygon does not — it is rebuilt at each
 * instant from whichever boundaries bounded it then, and plates are born and die.
 * See `dataTypes.ts` and `doc/model.md`.
 *
 * ── Why a canvas ──────────────────────────────────────────────────────────────
 * The same reason as `EarthCanvasNode`: every vertex moves whenever the clock does,
 * so rebuilding Scenery `Shape`s per frame would not keep up. The sphere-specific
 * path work — subdividing long segments, cutting at the limb, closing a polygon that
 * runs round the back — is all in {@link GlobeFeaturePainter}, shared with the Plate
 * Tectonics screen's globe.
 */

import { Multilink } from "scenerystack/axon";
import type { Bounds2 } from "scenerystack/dot";
import { CanvasNode, type Color, Node, type NodeOptions } from "scenerystack/scenery";
import { DeepTimeReconstruction, IDENTITY_ROTATION_SLOT } from "../../common/DeepTimeReconstruction.js";
import type { BoundaryType } from "../../common/data/dataTypes.js";
import { HISTORY_COASTLINES } from "../../common/data/generated/plateHistoryData.js";
import { PLATE_SNAPSHOTS } from "../../common/data/generated/plateSnapshotData.js";
import type { GlobeProjection } from "../../common/GlobeProjection.js";
import { GlobeFeaturePainter } from "../../common/view/GlobeFeaturePainter.js";
import PlateTectonicsColors from "../../PlateTectonicsColors.js";
import { BOUNDARY_LINE_WIDTH, PLATE_FILL_OPACITY } from "../../PlateTectonicsConstants.js";
import type { DeepTimeModel } from "../model/DeepTimeModel.js";

const TWO_PI = 2 * Math.PI;

/** Opacity of the deforming-belt wash, below the plate wash so it reads as texture. */
const DEFORMING_FILL_OPACITY = 0.5;

export type DeepTimeCanvasNodeOptions = NodeOptions;

/**
 * One scenery canvas layer. The plate wash is its own layer so overlapping plate
 * polygons can be filled opaquely and then composited once at PLATE_FILL_OPACITY.
 */
class DiscCanvasLayer extends CanvasNode {
  private readonly paint: (context: CanvasRenderingContext2D) => void;

  public constructor(bounds: Bounds2, paint: (context: CanvasRenderingContext2D) => void) {
    super({ canvasBounds: bounds, pickable: false });
    this.paint = paint;
  }

  public override paintCanvas(context: CanvasRenderingContext2D): void {
    this.paint(context);
  }
}

export class DeepTimeCanvasNode extends Node {
  private readonly model: DeepTimeModel;
  private readonly globe: GlobeProjection;
  private readonly reconstruction = new DeepTimeReconstruction();
  private readonly painter: GlobeFeaturePainter;
  private readonly oceanLayer: DiscCanvasLayer;
  private readonly plateLayer: DiscCanvasLayer;
  private readonly overlayLayer: DiscCanvasLayer;

  public constructor(model: DeepTimeModel, projection: GlobeProjection, options?: DeepTimeCanvasNodeOptions) {
    super(options);
    this.model = model;
    this.globe = projection;
    this.painter = new GlobeFeaturePainter(projection, this.reconstruction);

    const bounds = projection.viewBounds;
    this.oceanLayer = new DiscCanvasLayer(bounds, (context) => this.paintOcean(context));
    this.plateLayer = new DiscCanvasLayer(bounds, (context) => this.paintPlateFills(context));
    this.plateLayer.opacity = PLATE_FILL_OPACITY;
    this.overlayLayer = new DiscCanvasLayer(bounds, (context) => this.paintOverlay(context));
    this.children = [this.oceanLayer, this.plateLayer, this.overlayLayer];

    Multilink.multilinkAny(
      [
        model.showCoastlinesProperty,
        model.showPlatesProperty,
        model.showBoundariesProperty,
        model.showDeformingProperty,
        model.timeMaProperty,
        ...projection.cameraProperties,
        PlateTectonicsColors.oceanColorProperty,
        PlateTectonicsColors.landColorProperty,
        PlateTectonicsColors.coastlineColorProperty,
        PlateTectonicsColors.plateOutlineColorProperty,
        PlateTectonicsColors.divergentBoundaryColorProperty,
        PlateTectonicsColors.convergentBoundaryColorProperty,
        PlateTectonicsColors.transformBoundaryColorProperty,
        ...PlateTectonicsColors.platePaletteColorProperties,
      ],
      () => {
        this.plateLayer.visible = model.showPlatesProperty.value;
        this.oceanLayer.invalidatePaint();
        this.plateLayer.invalidatePaint();
        this.overlayLayer.invalidatePaint();
      },
    );
  }

  private clipToDisc(context: CanvasRenderingContext2D): void {
    context.beginPath();
    context.arc(this.globe.centerX, this.globe.centerY, this.globe.radius, 0, TWO_PI);
    context.clip();
  }

  private paintOcean(context: CanvasRenderingContext2D): void {
    context.save();
    this.clipToDisc(context);
    context.fillStyle = PlateTectonicsColors.oceanColorProperty.value.toCSS();
    context.beginPath();
    context.arc(this.globe.centerX, this.globe.centerY, this.globe.radius, 0, TWO_PI);
    context.fill();
    context.restore();
  }

  private paintOverlay(context: CanvasRenderingContext2D): void {
    this.reconstruction.setTime(this.model.timeMaProperty.value);
    const snapshot = this.snapshot;
    context.save();
    this.clipToDisc(context);
    if (this.model.showDeformingProperty.value) {
      this.paintDeformingBelts(context, snapshot);
    }
    if (this.model.showCoastlinesProperty.value) {
      this.paintCoastlines(context);
    }
    if (this.model.showPlatesProperty.value) {
      this.paintPlateOutlines(context, snapshot);
    }
    if (this.model.showBoundariesProperty.value) {
      this.paintBoundaries(context, snapshot);
    }
    context.restore();
  }

  /** The snapshot currently on screen — what the stepped layers are drawn from. */
  private get snapshot(): (typeof PLATE_SNAPSHOTS)[number] {
    this.reconstruction.setTime(this.model.timeMaProperty.value);
    return PLATE_SNAPSHOTS[this.reconstruction.nearestSnapshotIndex] as (typeof PLATE_SNAPSHOTS)[number];
  }

  // ── Continents ──────────────────────────────────────────────────────────────

  /**
   * Fills and outlines the reconstructed coastlines.
   *
   * Each piece was cookie-cut by plate ID at the present day, so it carries a single
   * rotation for the whole piece — India is one piece, and it crosses the Indian Ocean
   * as a unit. Nothing has to tear, which is why these take a single frame index
   * rather than one per vertex.
   */
  private paintCoastlines(context: CanvasRenderingContext2D): void {
    context.fillStyle = PlateTectonicsColors.landColorProperty.value.toCSS();
    for (const piece of HISTORY_COASTLINES) {
      context.beginPath();
      this.painter.appendFeature(context, piece.coords, piece.rotationSlot, "fill");
      context.fill();
    }

    context.strokeStyle = PlateTectonicsColors.coastlineColorProperty.value.toCSS();
    context.lineWidth = 0.6;
    for (const piece of HISTORY_COASTLINES) {
      context.beginPath();
      this.painter.appendFeature(context, piece.coords, piece.rotationSlot, "stroke");
      context.stroke();
    }
  }

  // ── Plates ──────────────────────────────────────────────────────────────────

  /**
   * Washes each rigid plate in its palette colour and outlines it.
   *
   * The colour is keyed on the GPlates plate ID rather than on the plate's position in
   * the snapshot, so a plate keeps its colour from one instant to the next instead of
   * flickering as its neighbours appear and vanish.
   *
   * The ring is already the resolved topology at this instant, so it is drawn as it
   * stands — see {@link DeepTimeCanvasNode.appendResolved}.
   *
   * ── Why the wash is its own CanvasNode ──────────────────────────────────────
   * The model's topologies are not a clean tiling: several plate IDs resolve to more
   * than one polygon at the same instant — flat slabs and sub-plates that overlap the
   * plate they belong to. Filling each one straight onto the globe at
   * {@link PLATE_FILL_OPACITY} stacks the alpha wherever two overlap, and the overlaps
   * are narrow slivers, so they came out as near-black streaks across the Pacific.
   * The fills are painted opaquely on {@link plateLayer}, and that layer's opacity is
   * {@link PLATE_FILL_OPACITY}, so an overlap looks exactly like a single plate.
   */
  private paintPlateFills(context: CanvasRenderingContext2D): void {
    this.reconstruction.setTime(this.model.timeMaProperty.value);
    const snapshot = this.snapshot;
    const palette = PlateTectonicsColors.platePaletteColorProperties;
    context.save();
    this.clipToDisc(context);
    for (const plate of snapshot.plates) {
      if (plate.deforming) {
        continue;
      }
      const paletteColor = palette[plate.plateId % palette.length] as (typeof palette)[number];
      context.fillStyle = paletteColor.value.toCSS();
      context.beginPath();
      this.appendResolved(context, plate.ring, "fill");
      context.fill();
    }
    context.restore();
  }

  private paintPlateOutlines(context: CanvasRenderingContext2D, snapshot: (typeof PLATE_SNAPSHOTS)[number]): void {
    context.strokeStyle = PlateTectonicsColors.plateOutlineColorProperty.value.toCSS();
    context.lineWidth = 0.7;
    for (const plate of snapshot.plates) {
      if (plate.deforming) {
        continue;
      }
      context.beginPath();
      this.appendResolved(context, plate.ring, "stroke");
      context.stroke();
    }
  }

  /**
   * Washes the deforming belts — the orogens and rifts where the model does not treat
   * the lithosphere as rigid. Drawn in the coastline colour at low opacity rather than
   * in a palette colour, because a belt is not a plate and should not read as one.
   */
  private paintDeformingBelts(context: CanvasRenderingContext2D, snapshot: (typeof PLATE_SNAPSHOTS)[number]): void {
    context.globalAlpha = DEFORMING_FILL_OPACITY;
    context.fillStyle = PlateTectonicsColors.plateOutlineColorProperty.value.toCSS();
    for (const plate of snapshot.plates) {
      if (!plate.deforming) {
        continue;
      }
      context.beginPath();
      this.appendResolved(context, plate.ring, "fill");
      context.fill();
    }
    context.globalAlpha = 1;
  }

  // ── Boundaries ──────────────────────────────────────────────────────────────

  /** Draws the boundaries grouped by kind, so the colour changes three times. */
  private paintBoundaries(context: CanvasRenderingContext2D, snapshot: (typeof PLATE_SNAPSHOTS)[number]): void {
    context.lineWidth = BOUNDARY_LINE_WIDTH;
    context.lineCap = "round";
    context.lineJoin = "round";

    for (const set of snapshot.boundaries) {
      context.strokeStyle = boundaryColor(set.type).toCSS();
      context.beginPath();
      for (const line of set.lines) {
        this.appendResolved(context, line, "open");
      }
      context.stroke();
    }
  }

  /**
   * Appends geometry that is *already* at the reconstructed instant, so no rotation is
   * applied to it. The painter still does the work that matters on a sphere —
   * subdividing long segments and cutting at the limb.
   */
  private appendResolved(
    context: CanvasRenderingContext2D,
    coords: readonly number[],
    mode: "fill" | "stroke" | "open",
  ): void {
    this.painter.appendFeature(context, coords, IDENTITY_ROTATION_SLOT, mode);
  }
}

/** Colour property for a boundary type. */
function boundaryColor(type: BoundaryType): Color {
  if (type === "divergent") {
    return PlateTectonicsColors.divergentBoundaryColorProperty.value;
  }
  return type === "convergent"
    ? PlateTectonicsColors.convergentBoundaryColorProperty.value
    : PlateTectonicsColors.transformBoundaryColorProperty.value;
}
