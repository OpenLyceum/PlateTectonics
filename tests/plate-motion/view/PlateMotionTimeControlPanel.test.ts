import { Display, globalKeyStateTracker, Node } from "scenerystack/scenery";
import { expect, it } from "vitest";
import { PlateMotionModel } from "../../../src/plate-motion/model/PlateMotionModel.js";
import { PlateMotionTimeControlPanel } from "../../../src/plate-motion/view/PlateMotionTimeControlPanel.js";

function pressAltK(): void {
  const key = { key: "k", code: "KeyK", altKey: true };
  globalKeyStateTracker.keydownUpdate(new KeyboardEvent("keydown", key));
  globalKeyStateTracker.keyupUpdate(new KeyboardEvent("keyup", key));
  globalKeyStateTracker.clearState();
}

it("only toggles play with Alt+K when playback is available", () => {
  const model = new PlateMotionModel();
  const panel = new PlateMotionTimeControlPanel(model);
  const focusOrder = new Node({ pdomOrder: panel.focusOrder });
  const root = new Node({ children: [panel, focusOrder] });
  const display = new Display(root);

  try {
    const playing = model.timer.isPlayingProperty;
    expect(playing.value).toBe(false);
    pressAltK();
    expect(playing.value).toBe(false);

    model.setPlate("left", "continental");
    model.setPlate("right", "oldOceanic");
    model.motionTypeProperty.value = "convergent";
    pressAltK();
    expect(playing.value).toBe(true);
    pressAltK();
    expect(playing.value).toBe(false);

    model.isManualModeProperty.value = true;
    pressAltK();
    expect(playing.value).toBe(false);
    model.isManualModeProperty.value = false;

    model.timeMillionsOfYearsProperty.value = model.timeLimitMyrProperty.value;
    pressAltK();
    expect(playing.value).toBe(false);
  } finally {
    display.dispose();
    focusOrder.dispose();
    for (const node of panel.focusOrder) {
      node.dispose();
    }
    panel.dispose();
    root.dispose();
    model.dispose();
  }
});
