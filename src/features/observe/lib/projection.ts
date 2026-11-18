import type { Vec3, View } from "../../../shared/types";
import { clamp } from "../../../shared/document";
import { sub } from "../../../shared/vector";

/** Resolution-independent framing box shared by every viewport size. */
export interface Frame {
  width: number;
  height: number;
  cx: number;
  cy: number;
  safe: number;
}
const BASE_HEIGHT = 560,
  MIN_ASPECT = 0.3,
  MAX_ASPECT = 3.2;
/**
 * Build the virtual scene from the viewport's pixel aspect ratio.
 *
 * The scene height stays constant and only the width follows the container,
 * so a phone-width window uses its tall area instead of letterboxing a 4:3
 * drawing into a sliver. Nothing here looks at the paper's projected outline,
 * so resizing can never trigger a zoom change on its own.
 */
export function frameFor(aspect: number): Frame {
  const width = BASE_HEIGHT * clamp(aspect, MIN_ASPECT, MAX_ASPECT),
    height = BASE_HEIGHT;
  return {
    width,
    height,
    cx: width / 2,
    cy: height / 2,
    // Keep the floating tabs (top) and tools (bottom) clear of the paper.
    safe: Math.min(width * 0.86, height * 0.72),
  };
}
export function cameraPoint(
  p: Vec3,
  view: Pick<View, "yaw" | "pitch">,
): Vec3 {
  const a = (view.yaw * Math.PI) / 180,
    b = (view.pitch * Math.PI) / 180,
    x = p[0] * Math.cos(a) - p[2] * Math.sin(a),
    z = p[0] * Math.sin(a) + p[2] * Math.cos(a);
  return [
    x,
    p[1] * Math.cos(b) - z * Math.sin(b),
    p[1] * Math.sin(b) + z * Math.cos(b),
  ];
}
/**
 * World radius -> pixels. Framing is driven by an orientation-independent
 * radius, never by the projected silhouette, so a face swinging out of view
 * cannot make the camera lunge forward.
 */
export function pixelsPerUnit(view: View, frame: Frame) {
  return (frame.safe / 2 / Math.max(0.05, view.radius)) * view.zoom;
}
export function project(p: Vec3, view: View, frame: Frame) {
  const c = cameraPoint(sub(p, view.focus), view),
    k = pixelsPerUnit(view, frame);
  return {
    x: frame.cx + c[0] * k,
    y: frame.cy - c[1] * k,
    z: c[2],
  };
}
export function polygon(points: Vec3[], view: View, frame: Frame) {
  return points
    .map((p) => {
      const v = project(p, view, frame);
      return `${v.x},${v.y}`;
    })
    .join(" ");
}
