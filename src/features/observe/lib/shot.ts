import type { Paper, PoseFace, Shot, Vec3 } from "../../../shared/types";
import { add, scale, sub, unit } from "../../../shared/vector";
import { cameraPoint } from "./projection";
import { clamp } from "../../../shared/document";

/** Yaw used by the default studio view; derived shots stay near it. */
export const HOME_YAW = -35;
export const HOME_PITCH = 50;
const DETAIL_PADDING = 1.06;
const FLAT_PADDING = 1.04;
/**
 * Share of the complete model that should stay inside the frame on teaching
 * steps. The finished step uses all of it, so the product is never cut off.
 */
const TEACHING_COVERAGE = 0.82;
const PRODUCT_COVERAGE = 1.03;

export interface CameraState {
  yaw: number;
  pitch: number;
  zoom: number;
  focus: Vec3;
  radius: number;
}

export function cloneShot(shot: Shot): Shot {
  return {
    yaw: shot.yaw,
    pitch: shot.pitch,
    zoom: shot.zoom,
    focus: [...shot.focus] as Vec3,
    radius: shot.radius,
  };
}
export function shotFromView(view: CameraState): Shot {
  return {
    yaw: view.yaw,
    pitch: Math.round(view.pitch * 100) / 100,
    zoom: view.zoom,
    focus: [...view.focus] as Vec3,
    radius: Math.max(0.05, view.radius),
  };
}
export function applyShot(view: CameraState, shot: Shot) {
  view.yaw = shot.yaw;
  view.pitch = shot.pitch;
  view.zoom = shot.zoom;
  view.focus = [...shot.focus] as Vec3;
  view.radius = shot.radius;
}
export function wrapAngle(delta: number) {
  return ((((delta + 180) % 360) + 360) % 360) - 180;
}
/**
 * How far the paper reaches across the screen for a given orientation.
 *
 * This is measured along the camera's own axes, but only for the shot's
 * planned orientation — never for whatever the paper is doing this frame. So
 * the framing fits the model snugly without ever reacting to a face turning
 * edge-on mid-fold, which is what used to cause the sudden zoom-in.
 */
function screenRadius(
  points: Vec3[],
  center: Vec3,
  yaw: number,
  pitch: number,
) {
  let max = 0;
  for (const p of points) {
    const c = cameraPoint(sub(p, center), { yaw, pitch });
    max = Math.max(max, Math.hypot(c[0], c[1]));
  }
  return max;
}
function boundsCenter(points: Vec3[]): Vec3 {
  if (!points.length) return [0, 0, 0];
  const min: Vec3 = [Infinity, Infinity, Infinity],
    max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const p of points)
    for (let i = 0; i < 3; i++) {
      min[i] = Math.min(min[i]!, p[i]!);
      max[i] = Math.max(max[i]!, p[i]!);
    }
  return scale(add(min, max), 0.5);
}
/** Faces carried along by a crease, including all their descendants. */
function movingFaces(paper: Paper, root: string) {
  const ids = new Set([root]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const f of paper.faces)
      if (f.parent && ids.has(f.parent) && !ids.has(f.id)) {
        ids.add(f.id);
        grew = true;
      }
  }
  return ids;
}
export function hingeInPose(
  paper: Paper,
  pose: PoseFace[],
  creaseId: string,
) {
  const crease = paper.creases.find((c) => c.id === creaseId),
    base = paper.faces.find((f) => f.id === crease?.face),
    face = pose.find((f) => f.id === crease?.face);
  if (!base?.hinge || !face) return null;
  const indices = base.hinge.map((h) =>
    base.points.findIndex((p) => p.every((n, i) => n === h[i])),
  );
  const a = face.points[indices[0]!],
    b = face.points[indices[1]!];
  return a && b ? { a, b } : null;
}
/**
 * Yaw that lays the hinge roughly horizontal on screen. Both `candidate` and
 * its opposite qualify, so pick the one nearer the studio yaw: this keeps
 * consecutive teaching shots from whipping the camera half a turn around.
 */
function yawFacingHinge(axis: Vec3) {
  const horizontal = Math.hypot(axis[0], axis[2]);
  // A hinge seen end-on has no screen direction; keep the studio yaw.
  if (horizontal < 0.25) return HOME_YAW;
  const candidate = (Math.atan2(-axis[2], axis[0]) * 180) / Math.PI,
    opposite = wrapAngle(candidate + 180);
  return Math.abs(wrapAngle(candidate - HOME_YAW)) <=
    Math.abs(wrapAngle(opposite - HOME_YAW))
    ? candidate
    : opposite;
}
/**
 * Build a deterministic teaching shot from the *world* pose.
 *
 * Framing is measured around the real hinge axis in world coordinates, then
 * evaluated once in the shot's planned orientation. Fitting the *current*
 * projected silhouette instead would make the camera lunge forward whenever
 * a face happens to turn edge-on and its 2D footprint narrows. Because the
 * result depends only on the step's own angles, jumping to a step and
 * reaching it through playback produce the exact same frame.
 *
 * The radius balances two goals: keep the moving flap large enough to teach
 * (`DETAIL_PADDING`) and keep the piece in frame (`TEACHING_COVERAGE`,
 * `PRODUCT_COVERAGE` on the finished step).
 */
export function deriveShot(
  paper: Paper,
  pose: PoseFace[],
  creaseId?: string | null,
  productStep = false,
): Shot {
  const points = pose.flatMap((f) => f.points);
  // The finished piece is framed as a whole, centred on its real bounds, so
  // the final step never crops the model to chase one small hinge.
  if (productStep) {
    const focus = boundsCenter(points),
      yaw = HOME_YAW,
      radius = Math.max(
        0.35,
        screenRadius(points, focus, yaw, HOME_PITCH) * PRODUCT_COVERAGE,
      );
    return { yaw, pitch: HOME_PITCH, zoom: 1, focus, radius };
  }
  const hinge = creaseId ? hingeInPose(paper, pose, creaseId) : null;
  if (!hinge) {
    const focus = boundsCenter(points),
      radius = Math.max(
        0.35,
        screenRadius(points, focus, HOME_YAW, HOME_PITCH) * FLAT_PADDING,
      );
    return { yaw: HOME_YAW, pitch: HOME_PITCH, zoom: 1, focus, radius };
  }
  const focus = scale(add(hinge.a, hinge.b), 0.5),
    yaw = yawFacingHinge(unit(sub(hinge.b, hinge.a))),
    pitch = HOME_PITCH,
    crease = paper.creases.find((c) => c.id === creaseId)!,
    moving = movingFaces(paper, crease.face),
    movingPoints = pose
      .filter((f) => moving.has(f.id))
      .flatMap((f) => f.points),
    local = screenRadius(
      movingPoints.length ? movingPoints : points,
      focus,
      yaw,
      pitch,
    ),
    whole = screenRadius(points, focus, yaw, pitch);
  return {
    yaw,
    pitch,
    zoom: 1,
    focus,
    radius: Math.max(
      0.35,
      local * DETAIL_PADDING,
      whole * TEACHING_COVERAGE,
    ),
  };
}
/**
 * Ease a view toward a shot. Yaw takes the shortest arc so crossing the back
 * of the paper never spins the long way round; radius and zoom ease in log
 * space, which reads as a steady dolly instead of an abrupt zoom. Returns
 * true once the view has effectively settled.
 */
export function easeShot(view: CameraState, target: Shot, dt: number) {
  // Already exactly on the shot: stop writing, so an idle camera does not
  // force a redraw every frame (and cannot jitter through rounding).
  if (
    view.yaw === target.yaw &&
    view.pitch === target.pitch &&
    view.zoom === target.zoom &&
    view.radius === target.radius &&
    view.focus[0] === target.focus[0] &&
    view.focus[1] === target.focus[1] &&
    view.focus[2] === target.focus[2]
  )
    return true;
  const step = clamp(dt, 0, 0.05),
    turn = 1 - Math.exp(-7 * step),
    move = 1 - Math.exp(-6 * step),
    dolly = 1 - Math.exp(-3.4 * step);
  view.yaw = wrapAngle(view.yaw + wrapAngle(target.yaw - view.yaw) * turn);
  view.pitch = clamp(
    view.pitch + (clamp(target.pitch, -85, 90) - view.pitch) * turn,
    -85,
    90,
  );
  view.focus = [
    view.focus[0] + (target.focus[0] - view.focus[0]) * move,
    view.focus[1] + (target.focus[1] - view.focus[1]) * move,
    view.focus[2] + (target.focus[2] - view.focus[2]) * move,
  ];
  const zoomTo = (current: number, goal: number) =>
    Math.exp(
      Math.log(Math.max(0.05, current)) +
        (Math.log(Math.max(0.05, goal)) - Math.log(Math.max(0.05, current))) *
          dolly,
    );
  view.radius = zoomTo(view.radius, target.radius);
  view.zoom = zoomTo(view.zoom, target.zoom);
  const settled =
    Math.abs(wrapAngle(target.yaw - view.yaw)) < 0.08 &&
    Math.abs(target.pitch - view.pitch) < 0.08 &&
    Math.hypot(
      target.focus[0] - view.focus[0],
      target.focus[1] - view.focus[1],
      target.focus[2] - view.focus[2],
    ) < 0.002 &&
    Math.abs(Math.log(target.radius / view.radius)) < 0.001 &&
    Math.abs(Math.log(target.zoom / view.zoom)) < 0.001;
  if (settled) applyShot(view, target);
  return settled;
}
/**
 * Track the fold while it is actually moving.
 *
 * The focus follows the real hinge midpoint in world coordinates, so the
 * framing stays on the action as the paper's mass and bounding volume shift.
 * The radius is only ever allowed to grow past the step's planned framing:
 * a flap turning edge-on makes the projected shape narrower, and fitting that
 * narrower silhouette would punch the camera in. Orientation deliberately
 * stays on the step's shot for the whole fold so repeated steps cannot whip
 * the view around between two nearby hinge axes.
 */
export function trackShot(
  base: Shot,
  paper: Paper,
  pose: PoseFace[],
  creaseId: string,
): Shot {
  const hinge = hingeInPose(paper, pose, creaseId);
  if (!hinge) return base;
  const focus = scale(add(hinge.a, hinge.b), 0.5),
    points = pose.flatMap((f) => f.points),
    crease = paper.creases.find((c) => c.id === creaseId),
    moving = crease ? movingFaces(paper, crease.face) : new Set<string>(),
    movingPoints = pose.filter((f) => moving.has(f.id)).flatMap((f) => f.points),
    // Measured in the shot's own orientation and only ever allowed to grow,
    // so the camera never punches in as a flap swings edge-on.
    local = screenRadius(
      movingPoints.length ? movingPoints : points,
      focus,
      base.yaw,
      base.pitch,
    ),
    whole = screenRadius(points, focus, base.yaw, base.pitch),
    radius = Math.max(
      base.radius,
      local * DETAIL_PADDING,
      whole * TEACHING_COVERAGE,
    );
  return { ...base, focus, radius };
}
/**
 * Grow a shot so the live pose fits, without changing where it looks or how
 * it is oriented. Used while the user hand-folds a crease: the paper may
 * swing outside the planned frame, but the view must not swivel or punch in
 * mid-drag just because the user moved a slider.
 */
export function widenShot(base: Shot, pose: PoseFace[]): Shot {
  const points = pose.flatMap((f) => f.points),
    needed = screenRadius(points, base.focus, base.yaw, base.pitch);
  return needed > base.radius ? { ...base, radius: needed } : base;
}
export function sameAngles(
  a: Record<string, number>,
  b: Record<string, number>,
) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys)
    if (Math.abs((a[key] ?? 0) - (b[key] ?? 0)) > 0.5) return false;
  return true;
}
