export function hexToRgb(hex: string): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `${r},${g},${b}`;
}

/** SVG path for a rect with bottom-only corner radius */
export function bottomRoundedRect(x: number, y: number, w: number, h: number, r: number): string {
  const r2 = Math.min(r, w / 2, h / 2);
  return (
    `M${x} ${y}` +
    `H${x + w}` +
    `V${y + h - r2}` +
    `Q${x + w} ${y + h} ${x + w - r2} ${y + h}` +
    `H${x + r2}` +
    `Q${x} ${y + h} ${x} ${y + h - r2}` +
    `Z`
  );
}

/** Smooth cubic-Bézier line + closed area path, xs span 0→graphW */
export function makeLinePaths(
  paces: number[],
  graphW: number,
  barH: number,
  minP: number,
  paceRange: number,
): { linePath: string; areaPath: string; ys: number[] } {
  const n = paces.length;
  if (n === 0) return { linePath: '', areaPath: '', ys: [] };

  const xs = n === 1
    ? [graphW / 2]
    : paces.map((_, i) => (i / (n - 1)) * graphW);

  const ys = paces.map((pace) => {
    const norm = paceRange > 0 ? (pace - minP) / paceRange : 0.5;
    return barH * 0.1 + barH * 0.8 * norm;
  });

  let d = `M ${xs[0]} ${ys[0]}`;
  for (let i = 1; i < n; i++) {
    const cx = (xs[i - 1] + xs[i]) / 2;
    d += ` C ${cx} ${ys[i - 1]}, ${cx} ${ys[i]}, ${xs[i]} ${ys[i]}`;
  }

  const area =
    n > 1
      ? `${d} L ${xs[n - 1]} ${barH} L ${xs[0]} ${barH} Z`
      : '';

  return { linePath: d, areaPath: area, ys };
}
