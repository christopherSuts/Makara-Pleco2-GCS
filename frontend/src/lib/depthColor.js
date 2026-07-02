/**
 * depthColor.js — depth → color mapping for the map track.
 *
 * Kept intentionally consistent with EchosounderPanel.getDepthColor (the live
 * view) so the live and review modes agree on what a given depth looks like:
 *   shallow (min) → red (danger)  →  yellow  →  deep (max) → green (safe)
 *
 * `min`/`max` default to the live view's fixed 0–100 m scale. Pass a data-driven
 * [min,max] (adaptive scale) when you want more contrast on a shallow survey.
 */
export const DEPTH_MIN = 0;
export const DEPTH_MAX = 100;

/**
 * Dynamic depth → RGB, driven by the actual data range:
 *   min depth (shallowest) → RED  →  yellow  →  GREEN (deepest = max).
 * Returns channels in 0–255. Use this for the interpolated 2D/3D surface so
 * the palette always spans the received data's [min,max].
 */
export function depthToRgb(depth, min, max) {
  const span = max - min || 1;
  const t = Math.max(0, Math.min(1, (Number(depth) - min) / span));
  let r, g;
  if (t < 0.5) {
    r = 255;
    g = Math.round(255 * (t / 0.5)); // red → yellow
  } else {
    r = Math.round(255 * (1 - (t - 0.5) / 0.5)); // yellow → green
    g = 255;
  }
  return { r, g, b: 0 };
}

/** Same mapping as depthToRgb, as a CSS `rgb(...)` string for Leaflet/DOM. */
export function depthToColorDynamic(depth, min, max) {
  const { r, g, b } = depthToRgb(depth, min, max);
  return `rgb(${r}, ${g}, ${b})`;
}

export function depthToColor(depth, min = DEPTH_MIN, max = DEPTH_MAX) {
  const span = max - min || 1;
  const clamped = Math.max(min, Math.min(max, Number(depth) || 0));
  const normalized = (clamped - min) / span;

  let r, g, b;
  if (normalized < 0.3) {
    const t = normalized / 0.3; // red → yellow
    r = 255;
    g = Math.round(255 * t);
    b = 0;
  } else if (normalized < 0.6) {
    const t = (normalized - 0.3) / 0.3; // yellow → light green
    r = Math.round(255 * (1 - t));
    g = 255;
    b = 0;
  } else {
    const t = (normalized - 0.6) / 0.4; // light green → green
    r = 0;
    g = 255;
    b = Math.round(100 * t);
  }
  return `rgb(${r}, ${g}, ${b})`;
}
