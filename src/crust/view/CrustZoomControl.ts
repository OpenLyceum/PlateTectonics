/**
 * CrustZoomControl.ts
 *
 * How far down the Crust screen looks: at the crust itself, out to the base of the
 * lithosphere, or all the way to the centre of the Earth.
 *
 * Three discrete steps rather than PhET's continuous zoom slider. A continuous zoom
 * across four orders of magnitude spends most of its travel at scales where nothing
 * is legible — the crust is a hairline for the top three quarters of the slider. The
 * three stops are the three scales worth looking at, and each one is a scale a
 * textbook figure would actually be drawn at.
 *
 * One row rather than a stacked panel, because it sits under the section it acts on
 * rather than in the control column: a column of "My Crust", "View" and a stacked zoom
 * panel is taller than the screen.
 */

import type { Property, TReadOnlyProperty } from "scenerystack/axon";
import { type EmptySelfOptions, optionize } from "scenerystack/phet-core";
import { HBox, type Node, Text } from "scenerystack/scenery";
import { PhetFont } from "scenerystack/scenery-phet";
import { HorizontalAquaRadioButtonGroup } from "scenerystack/sun";
import { PlateTectonicsPanel, type PlateTectonicsPanelOptions } from "../../common/PlateTectonicsPanel.js";
import { StringManager } from "../../i18n/StringManager.js";
import PlateTectonicsColors from "../../PlateTectonicsColors.js";
import type { CrustZoom } from "../model/CrustModel.js";

const TITLE_FONT = new PhetFont({ size: 14, weight: "bold" });
const LABEL_FONT = new PhetFont(13);

/** Widest any one label may grow before it is scaled down, px. */
const LABEL_MAX_WIDTH = 140;

export type CrustZoomControlOptions = PlateTectonicsPanelOptions;

export class CrustZoomControl extends PlateTectonicsPanel {
  /** The interactive children, in the order the user should reach them. */
  public readonly focusOrder: Node[];

  public constructor(zoomProperty: Property<CrustZoom>, providedOptions?: CrustZoomControlOptions) {
    const strings = StringManager.getInstance();
    const crust = strings.getCrustStrings();
    const a11y = strings.getCrustA11yStrings().controls;

    const label = (text: TReadOnlyProperty<string>): Text =>
      new Text(text, {
        font: LABEL_FONT,
        fill: PlateTectonicsColors.textColorProperty,
        maxWidth: LABEL_MAX_WIDTH,
      });

    const radioButtons = new HorizontalAquaRadioButtonGroup<CrustZoom>(
      zoomProperty,
      [
        { value: "crust", createNode: () => label(crust.zoomCrustStringProperty) },
        { value: "lithosphere", createNode: () => label(crust.zoomLithosphereStringProperty) },
        { value: "earth", createNode: () => label(crust.zoomEarthStringProperty) },
      ],
      {
        spacing: 14,
        radioButtonOptions: {
          radius: 7,
          selectedColor: PlateTectonicsColors.accentColorProperty,
          deselectedColor: PlateTectonicsColors.controlSurfaceColorProperty,
          stroke: PlateTectonicsColors.panelBorderColorProperty,
        },
        accessibleName: a11y.zoomStringProperty,
        accessibleHelpText: a11y.zoomHelpStringProperty,
      },
    );

    const content = new HBox({
      spacing: 14,
      align: "center",
      children: [
        new Text(crust.zoomStringProperty, {
          font: TITLE_FONT,
          fill: PlateTectonicsColors.textColorProperty,
          maxWidth: LABEL_MAX_WIDTH,
        }),
        radioButtons,
      ],
    });

    const options = optionize<CrustZoomControlOptions, EmptySelfOptions, PlateTectonicsPanelOptions>()(
      { yMargin: 7 },
      providedOptions,
    );
    super(content, options);

    this.focusOrder = [radioButtons];
  }
}
