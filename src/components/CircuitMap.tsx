import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { svgPathProperties } from 'svg-path-properties';

const CIRCUIT_PATH = 'M103.184 98.296L104.912 93.580L132.665 17.5331C133.833 14.3174 135.554 11.2902 137.891 8.80303C142.036 4.39403 149.259 -0.0149686 160.124 4.20561C160.124 4.20561 172.283 8.68998 168.641 20.6106C168.641 20.6106 165.664 28.9136 159.546 27.9715C158.077 27.7454 156.758 26.9415 155.715 25.8863C154.76 24.9066 153.517 23.4118 152.6 21.4397C151.758 19.6434 150.075 18.94 148.555 18.6887C146.382 18.337 144.108 18.8395 142.488 20.3217C141.106 21.5778 139.926 23.7258 140.767 27.2681C142.463 34.3401 148.517 38.2717 148.517 38.2717C148.517 38.2717 151.947 41.1357 156.707 40.784C161.468 40.4323 215.695 32.7699 215.695 32.7699C215.695 32.7699 219.438 31.9409 224.011 33.2221C228.583 34.5034 263.754 43.0827 263.754 43.0827C263.754 43.0827 270.864 45.2684 265.94 50.5818C261.016 55.8952 250.276 56.7117 250.276 56.7117C250.276 56.7117 226.962 57.4528 206.94 54.8526C186.917 52.2399 178.828 67.8912 178.828 67.8912C178.828 67.8912 171.442 78.5557 179.87 95.2998C180.988 97.5106 182.37 99.5832 183.865 101.568C187.294 106.14 195.296 118.902 186.993 129.265C183.099 134.127 176.868 136.438 170.663 135.973C167.711 135.747 163.855 135.22 158.868 134.152C157.335 133.825 155.728 133.75 154.208 134.114C150.992 134.88 146.998 137.594 150.464 146.751L153.542 155.267C153.542 155.267 154.484 159.061 159.936 159.174C165.387 159.287 253.203 161.661 253.203 161.661C253.203 161.661 258.202 161.711 256.532 155.531C254.861 149.351 251.608 143.698 260.539 141.563C263.641 140.822 266.907 140.897 269.972 141.739C276.554 143.548 286.754 149.15 281.026 166.359C281.026 166.359 275.06 181.118 258.918 181.269C242.777 181.42 4.41473 182.5 4.41473 182.5C4.41473 182.5 0.483053 182.01 3.88715 177.702C5.20608 176.018 7.44199 174.7 9.67789 173.695C13.1448 172.15 16.9006 171.371 20.6941 171.22L75.2602 169.047C75.2602 169.047 77.7724 168.494 78.3754 166.359L78.3628 166.309L103.184 98.296';

interface Props {
  progress: number;
  startColor?: string;
  endColor?: string;
  path?: string;
  accentColor?: string;
  overlays?: Array<{ d: string; fill: 'accent' | 'light' }>;
  viewBoxWidth?: number;
  viewBoxHeight?: number;
}

export const CIRCUIT_VIEWBOX = { width: 286, height: 185 } as const;

const pathCache = new Map<string, svgPathProperties>();

function getPathProps(path: string) {
  const cached = pathCache.get(path);
  if (cached) return cached;
  const props = new svgPathProperties(path);
  pathCache.set(path, props);
  return props;
}

function getTotalLength(path: string) {
  return getPathProps(path).getTotalLength();
}

function lerp(a: number, b: number, t: number) {
  return Math.round(a + (b - a) * t);
}

function toHex(v: number) {
  return v.toString(16).padStart(2, '0').toUpperCase();
}

function parseHexColor(hex: string) {
  const normalized = hex.replace('#', '');
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

function colorAt(startHex: string, endHex: string, t: number) {
  const clamped = Math.max(0, Math.min(1, t));
  const start = parseHexColor(startHex);
  const end = parseHexColor(endHex);
  const r = lerp(start.r, end.r, clamped);
  const g = lerp(start.g, end.g, clamped);
  const b = lerp(start.b, end.b, clamped);
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function getCircuitPointAtProgress(progress: number, path = CIRCUIT_PATH) {
  const p = Math.max(0, Math.min(progress, 1));
  const props = getPathProps(path);
  const len = p * props.getTotalLength();
  return props.getPointAtLength(len);
}

export function getCircuitTangentAtProgress(progress: number, path = CIRCUIT_PATH) {
  const p = Math.max(0, Math.min(progress, 1));
  const props = getPathProps(path);
  const totalLength = props.getTotalLength();
  const len = p * totalLength;
  const delta = Math.max(1, totalLength * 0.002);
  const prev = props.getPointAtLength(Math.max(0, len - delta));
  const next = props.getPointAtLength(Math.min(totalLength, len + delta));
  const dx = next.x - prev.x;
  const dy = next.y - prev.y;
  const mag = Math.hypot(dx, dy) || 1;
  return { x: dx / mag, y: dy / mag };
}

export default function CircuitMap({
  progress,
  startColor = '#FCB827',
  endColor = '#FC8A27',
  path = CIRCUIT_PATH,
  accentColor,
  overlays,
  viewBoxWidth,
  viewBoxHeight,
}: Props) {
  const vbW = viewBoxWidth ?? CIRCUIT_VIEWBOX.width;
  const vbH = viewBoxHeight ?? CIRCUIT_VIEWBOX.height;
  const p = Math.max(0, Math.min(progress, 1));
  const totalLength = getTotalLength(path);
  const drawn = Math.max(2, p * totalLength);

  const gradientSegments = useMemo(() => {
    const count = Math.max(36, Math.min(220, Math.ceil(drawn / 6)));
    const segLen = drawn / count;
    const out: Array<{ color: string; gap: number; len: number }> = [];

    for (let i = 0; i < count; i += 1) {
      out.push({
        color: colorAt(startColor, endColor, count <= 1 ? 0 : i / (count - 1)),
        gap: i * segLen,
        len: segLen,
      });
    }

    return out;
  }, [drawn, endColor, startColor]);

  return (
    <View style={s.wrap}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${vbW} ${vbH}`} preserveAspectRatio="xMidYMid meet">
        <Path d={path} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={5} strokeMiterlimit={10} />
        {overlays?.map((o, i) => (
          <Path
            key={`overlay-${i}`}
            d={o.d}
            fill={o.fill === 'accent' ? (accentColor ?? startColor) : '#FFFFFF'}
          />
        ))}
        {[...gradientSegments].reverse().map((seg, idx) => (
          <Path
            key={`seg-${idx}`}
            d={path}
            fill="none"
            stroke={seg.color}
            strokeWidth={5}
            strokeMiterlimit={10}
            strokeLinecap="butt"
            strokeLinejoin="round"
            strokeDasharray={`0 ${seg.gap} ${seg.len + 0.2} ${totalLength}`}
          />
        ))}
      </Svg>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1 },
});
