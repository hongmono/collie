import {
  __resetTerminalFitMode,
  markTerminalPaneFitted,
  setTerminalFitMode,
  terminalFitModeEnabled,
  terminalPaneWasFitted,
} from "./terminal-fit-mode";

describe("terminal fit mode", () => {
  beforeEach(() => __resetTerminalFitMode());

  it("is scoped per Herdr session and remembers each fitted pane", () => {
    setTerminalFitMode("default", true);
    markTerminalPaneFitted("default", "w1:p1");

    expect(terminalFitModeEnabled("default")).toBe(true);
    expect(terminalPaneWasFitted("default", "w1:p1")).toBe(true);
    expect(terminalFitModeEnabled("other")).toBe(false);
    expect(terminalPaneWasFitted("other", "w1:p1")).toBe(false);
  });

  it("clears fitted history when disabled so re-enabling can fit the current pane again", () => {
    setTerminalFitMode(undefined, true);
    markTerminalPaneFitted(undefined, "w1:p1");
    setTerminalFitMode(undefined, false);

    expect(terminalFitModeEnabled(undefined)).toBe(false);
    expect(terminalPaneWasFitted(undefined, "w1:p1")).toBe(false);
    setTerminalFitMode(undefined, true);
    expect(terminalPaneWasFitted(undefined, "w1:p1")).toBe(false);
  });
});
