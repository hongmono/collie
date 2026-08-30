export interface TerminalGrid {
  cols: number;
  rows: number;
}

/** Convert the visible mirror scrollport into terminal cells at its actual rendered font metrics. */
export function measureTerminalGrid(scrollport: HTMLElement): TerminalGrid | null {
  const pre = scrollport.querySelector<HTMLElement>("[data-terminal-output]");
  if (!pre) return null;
  const preStyle = getComputedStyle(pre);
  const portStyle = getComputedStyle(scrollport);

  // Measure a run rather than one glyph so sub-pixel rounding does not cost/gain a whole column.
  const probe = document.createElement("span");
  probe.textContent = "0000000000";
  probe.setAttribute("aria-hidden", "true");
  Object.assign(probe.style, {
    position: "absolute",
    visibility: "hidden",
    whiteSpace: "pre",
    pointerEvents: "none",
    fontFamily: preStyle.fontFamily,
    fontSize: preStyle.fontSize,
    fontStyle: preStyle.fontStyle,
    fontWeight: preStyle.fontWeight,
    fontVariantLigatures: "none",
    letterSpacing: preStyle.letterSpacing,
  });
  document.body.appendChild(probe);
  const measured = probe.getBoundingClientRect().width / 10;
  probe.remove();

  const fontSize = Number.parseFloat(preStyle.fontSize);
  const lineHeight = Number.parseFloat(preStyle.lineHeight) || fontSize * 1.25;
  // A hidden measurement can be zero in an old WebView while the page is backgrounding. The
  // monospace fallback is approximate but still preferable to firing an invalid 0-column resize.
  const cellWidth = measured > 0 ? measured : fontSize * 0.6;
  const horizontalPadding =
    Number.parseFloat(portStyle.paddingLeft) + Number.parseFloat(portStyle.paddingRight);
  const verticalPadding =
    Number.parseFloat(portStyle.paddingTop) + Number.parseFloat(portStyle.paddingBottom);
  const width = scrollport.clientWidth - horizontalPadding;
  const height = scrollport.clientHeight - verticalPadding;
  if (!(cellWidth > 0) || !(lineHeight > 0) || width <= 0 || height <= 0) return null;

  return {
    cols: Math.max(1, Math.min(1000, Math.floor(width / cellWidth))),
    rows: Math.max(1, Math.min(1000, Math.floor(height / lineHeight))),
  };
}
