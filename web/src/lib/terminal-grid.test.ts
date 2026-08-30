import { measureTerminalGrid } from "./terminal-grid";

describe("measureTerminalGrid", () => {
  it("subtracts scrollport padding and uses the rendered terminal line metrics", () => {
    const port = document.createElement("div");
    port.style.padding = "5px 6px";
    Object.defineProperty(port, "clientWidth", { value: 300 });
    Object.defineProperty(port, "clientHeight", { value: 250 });
    const pre = document.createElement("pre");
    pre.dataset.terminalOutput = "";
    pre.style.fontSize = "10px";
    pre.style.lineHeight = "12.5px";
    port.appendChild(pre);
    document.body.appendChild(port);

    // jsdom gives the hidden glyph probe a zero rect, exercising the documented 0.6em fallback:
    // (300 - 12) / 6 = 48 cols; (250 - 10) / 12.5 = 19 rows.
    expect(measureTerminalGrid(port)).toEqual({ cols: 48, rows: 19 });
    port.remove();
  });

  it("refuses to guess when no terminal output is rendered", () => {
    expect(measureTerminalGrid(document.createElement("div"))).toBeNull();
  });
});
