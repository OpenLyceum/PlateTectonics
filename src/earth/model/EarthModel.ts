/**
 * EarthModel.ts
 *
 * All simulation state, as AXON Properties the view observes.
 *
 * The model holds no geometry of its own: the plates, boundaries, earthquakes and
 * volcanoes are fixed observational datasets (see `src/common/data/`). The
 * model state selects which present-day data layers and projection are shown.
 *
 * ── State groups ──────────────────────────────────────────────────────────────
 *  - Layer visibility: which overlays are drawn.
 *  - Earthquake depth filter: which hypocentres are drawn.
 *  - View selection: the Earth drawn as a 3-D globe or as a flat map.
 */

import type { TReadOnlyProperty } from "scenerystack/axon";
import { BooleanProperty, DerivedProperty, Property } from "scenerystack/axon";
import type { TModel } from "scenerystack/joist";
import type { EarthquakeDepthFilter } from "./EarthquakeDepthFilter.js";

export class EarthModel implements TModel {
  // ── Layer visibility ────────────────────────────────────────────────────────
  //
  // Every layer starts off. The sim opens on a bare ocean-and-coastline map, and the
  // question it asks is which of these datasets to put on it — which is a question a
  // student can only see if the answer is not already drawn for them. Switching two
  // layers on and finding where they coincide is the interaction hint the screen
  // summary gives, and it only means anything from an empty map.

  /** The per-plate colour wash and plate outlines. */
  public readonly showPlatesProperty = new BooleanProperty(false);

  /** Plate boundaries, colour-coded divergent / convergent / transform. */
  public readonly showBoundariesProperty = new BooleanProperty(false);

  /** Absolute plate motion vectors, scaled in mm/year. */
  public readonly showVectorsProperty = new BooleanProperty(false);

  /** Earthquake epicentres, sized by magnitude and coloured by depth. */
  public readonly showEarthquakesProperty = new BooleanProperty(false);

  /** Holocene volcanoes and intraplate hotspots. */
  public readonly showVolcanoesProperty = new BooleanProperty(false);

  /** The shaded relief raster: land topography and ocean-floor bathymetry. */
  public readonly showTopographyProperty = new BooleanProperty(false);

  /**
   * Isochrons of the ocean floor — lines of equal crustal age, coloured young to old.
   * Best read with the boundaries on and everything else off, which is when the
   * isochrons and the ridges that made them are the only two things on the map.
   */
  public readonly showSeafloorAgeProperty = new BooleanProperty(false);

  // ── Filtering ───────────────────────────────────────────────────────────────

  /** Which earthquake depth band to show. */
  public readonly earthquakeDepthFilterProperty = new Property<EarthquakeDepthFilter>("all");

  // ── View selection ──────────────────────────────────────────────────────────

  /**
   * Whether the Earth is drawn as a rotatable 3-D globe rather than as the flat
   * equirectangular map. The globe is the default because it shows shapes and
   * distances honestly, which is what makes a circum-Pacific belt of earthquakes look
   * like a ring rather than a horseshoe smeared across two edges of a rectangle; the
   * flat map shows the whole world at once and is the better place to compare one
   * ocean with another.
   */
  public readonly showGlobeProperty = new BooleanProperty(true);

  /** True while the flat map is on screen — the complement of {@link showGlobeProperty}. */
  public readonly isFlatMapProperty: TReadOnlyProperty<boolean>;

  public constructor() {
    this.isFlatMapProperty = new DerivedProperty([this.showGlobeProperty], (showGlobe: boolean) => !showGlobe);
  }

  /** The Earth screen shows fixed present-day datasets. */
  public step(_dt: number): void {
    // Layer and camera changes drive the view; no geological clock runs here.
  }

  /** Resets all model state to its initial values (the Reset All button). */
  public reset(): void {
    this.showPlatesProperty.reset();
    this.showGlobeProperty.reset();
    this.showBoundariesProperty.reset();
    this.showVectorsProperty.reset();
    this.showEarthquakesProperty.reset();
    this.showVolcanoesProperty.reset();
    this.showTopographyProperty.reset();
    this.showSeafloorAgeProperty.reset();
    this.earthquakeDepthFilterProperty.reset();
  }

  /**
   * Releases the derived view-selection property, so a discarded screen can be
   * collected. The view's own links are torn down with the view, not here.
   */
  public dispose(): void {
    this.isFlatMapProperty.dispose();
  }
}
