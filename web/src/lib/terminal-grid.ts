export interface TerminalGrid {
  cols: number;
  rows: number;
}

/** Convert the visible mirror scrollport into terminal cells at its actual rendered font metrics. */
export function measureTerminalGrid(
  scrollport: HTMLElement,
  fallbackFontSize = 11,
): TerminalGrid | null {
  const pre = scrollport.querySelector<HTMLElement>("[data-terminal-output]");
  const metricSource = pre ?? document.createElement("span");
  if (!pre) {
    metricSource.className = "font-mono";
    metricSource.style.fontSize = `${fallbackFontSize}px`;
    metricSource.style.lineHeight = "1.25";
    metricSource.style.position = "absolute";
    metricSource.style.visibility = "hidden";
    document.body.appendChild(metricSource);
  }
  const preStyle = getComputedStyle(metricSource);
  const portStyle = getComputedStyle(scrollport);

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
  if (!pre) metricSource.remove();

  const fontSize = Number.parseFloat(preStyle.fontSize);
  const rawLineHeight = Number.parseFloat(preStyle.lineHeight);
  const lineHeight =
    rawLineHeight > 0
      ? rawLineHeight < fontSize * 0.5
        ? rawLineHeight * fontSize
        : rawLineHeight
      : fontSize * 1.25;
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
