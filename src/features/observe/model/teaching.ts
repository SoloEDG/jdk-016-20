import type { Document, PoseFace, Shot, Step } from "../../../shared/types";
import { solvePose } from "../../fold/lib/kinematics";
import { cloneShot, deriveShot, trackShot, widenShot } from "../lib/shot";

const HOME: Shot = {
  yaw: -35,
  pitch: 50,
  zoom: 1,
  focus: [0, 0, 0],
  radius: 1.45,
};
const cache = new Map<string, Shot>();

/**
 * The crease a user is currently shaping by hand. Steps store cumulative
 * angles, so a settled step with one differing angle identifies it exactly.
 */
function editedCrease(doc: Document) {
  const step = doc.steps[doc.step];
  if (!step) return null;
  const changed = doc.paper.creases.filter(
    (c) => Math.abs((doc.angles[c.id] ?? 0) - (step.angles[c.id] ?? 0)) > 0.5,
  );
  if (changed.length === 1) return changed[0]!.id;
  return changed.some((c) => c.id === doc.selected) ? doc.selected : null;
}
function anglesKey(angles: Record<string, number>) {
  return Object.keys(angles)
    .sort()
    .map((key) => key + ":" + angles[key])
    .join(",");
}
/**
 * The teaching camera for one step.
 *
 * A saved shot always wins. Otherwise the shot is derived from that step's
 * own fold angles, which is what makes "jump to step N" and "play from the
 * start" land on exactly the same frame: neither path depends on where the
 * camera happened to be, or on the current on-screen silhouette. A step with
 * no stored shot is simply an older document, so it gets this default too.
 */
export function resolveStepShot(
  doc: Document,
  index: number,
  product = false,
): Shot {
  const step: Step | undefined = doc.steps[index];
  if (!step) return cloneShot(HOME);
  if (step.shot) return cloneShot(step.shot);
  const key = [
    doc.paper.id,
    step.id,
    product ? "product" : "teach",
    anglesKey(step.angles),
  ].join("|");
  const hit = cache.get(key);
  if (hit) return cloneShot(hit);
  const pose = solvePose(doc.paper, step.angles);
  const crease = creaseFor(doc, index);
  const shot = deriveShot(doc.paper, pose, crease, product);
  cache.set(key, shot);
  return cloneShot(shot);
}
export function creaseFor(doc: Document, index: number) {
  return index > 0 ? (doc.paper.creases[index - 1]?.id ?? null) : null;
}
/**
 * Which shot the camera should be aiming at right now.
 *
 * While a fold is in progress the target keeps following that fold's live
 * hinge, so the key action stays centred and the framing does not react to
 * the narrow 2D silhouette of an edge-on face. Once the step settles, the
 * target becomes exactly that step's saved-or-derived shot, which is what
 * makes step-jumping and start-to-finish playback agree on the final frame.
 */
export function teachingTarget(doc: Document, pose: PoseFace[]) {
  const last = doc.steps.length - 1,
    incoming = doc.cue !== doc.step ? doc.cue : null,
    incomingCrease = incoming == null ? null : creaseFor(doc, incoming),
    edited = editedCrease(doc);
  // The paper is mid-fold whenever the one crease being shaped is exactly the
  // fold we are heading into — true while playing, and still true if paused
  // half-way. Orientation comes from the step's plan so the view does not
  // swivel as the paper swings; only the focus rides the live hinge, and the
  // radius never reacts to the projected silhouette.
  if (edited && incoming != null && edited === incomingCrease) {
    const base = resolveStepShot(doc, incoming);
    return trackShot(base, doc.paper, pose, edited);
  }
  // Shaping something else by hand: keep this step's planned framing and only
  // widen it if the live paper no longer fits. Re-aiming here would yank the
  // view around while the user drags an angle slider.
  if (edited) return widenShot(resolveStepShot(doc, doc.step, doc.step === last), pose);
  // The whole-product frame is already centred on the real bounds; tracking a
  // single hinge there would crop the finished piece.
  return resolveStepShot(doc, doc.step, doc.step === last);
}
