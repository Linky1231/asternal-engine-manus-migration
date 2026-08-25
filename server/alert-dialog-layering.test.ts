import {
  ALERT_DIALOG_CONTENT_LAYER,
  ALERT_DIALOG_OVERLAY_LAYER,
} from "../src/components/ui/alert-dialog";
import { describe, expect, it } from "vitest";

describe("jerarquía de los diálogos de alerta", () => {
  it("queda por encima de los paneles de juego a pantalla completa", () => {
    expect(ALERT_DIALOG_OVERLAY_LAYER).toBe("z-[100]");
    expect(ALERT_DIALOG_CONTENT_LAYER).toBe("z-[110]");
  });
});
