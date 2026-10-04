import { describe, expect, it } from "vitest";
import { PlateMotionModel } from "../src/plate-motion/model/PlateMotionModel.js";
import { PlateMotionTimeControlPanel } from "../src/plate-motion/view/PlateMotionTimeControlPanel.js";

describe("Plate motion transport controls", () => {
  it("disables Play at the end and enables it again on Rewind", () => {
    const model = new PlateMotionModel();
    const panel = new PlateMotionTimeControlPanel(model);
    const play = panel.focusOrder[0];
    expect(play?.enabled).toBe(false);
    model.setPlate("left", "continental");
    model.setPlate("right", "oldOceanic");
    model.motionTypeProperty.value = "convergent";
    expect(play?.enabled).toBe(true);
    model.timer.isPlayingProperty.value = true;
    model.step(1000);
    expect(play?.enabled).toBe(false);
    model.rewind();
    expect(play?.enabled).toBe(true);
    panel.dispose();
    model.dispose();
  });
});
