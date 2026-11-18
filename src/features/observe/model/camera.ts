import { onUnmounted, watch } from "vue";
import type { Document, Shot } from "../../../shared/types";
import { clamp } from "../../../shared/document";
import { applyShot, easeShot, shotFromView } from "../lib/shot";

const ZOOM_MIN = 0.35;
const ZOOM_MAX = 2.6;

/** Any explicit camera move takes the view away from the teacher at once. */
export function takeOver(doc: Document) {
  doc.follow = false;
}
export function setView(doc: Document, preset: string) {
  if (preset === "top") {
    doc.view.yaw = 0;
    doc.view.pitch = 90;
  } else if (preset === "front") {
    doc.view.yaw = 0;
    doc.view.pitch = 15;
  } else {
    doc.view.yaw = -35;
    doc.view.pitch = 50;
  }
  doc.view.zoom = 1;
  doc.follow = false;
}
export function orbit(doc: Document, dx: number, dy: number) {
  doc.follow = false;
  doc.view.yaw += dx * 0.45;
  doc.view.pitch = clamp(doc.view.pitch + dy * 0.35, -85, 90);
}
export function zoom(doc: Document, delta: number) {
  doc.follow = false;
  // Multiplicative so a narrow phone window and a wide desktop move at the
  // same visual rate, and repeated steps never quite reach zero.
  doc.view.zoom = clamp(
    doc.view.zoom * Math.exp(clamp(delta, -0.5, 0.5)),
    ZOOM_MIN,
    ZOOM_MAX,
  );
}
/** Hand the view back to the teaching camera; fold angles are untouched. */
export function restoreTeachingView(doc: Document) {
  doc.follow = true;
}
/** Toggle follow on/off without touching any fold angle. */
export function toggleTeachingView(doc: Document) {
  doc.follow = !doc.follow;
}
/** Store exactly what is on screen as this step's teaching camera. */
export function saveStepShot(doc: Document) {
  const step = doc.steps[doc.step];
  if (!step) return false;
  step.shot = shotFromView(doc.view);
  doc.follow = true;
  return true;
}
/** Drop the saved shot so the step falls back to its derived framing. */
export function clearStepShot(doc: Document) {
  const step = doc.steps[doc.step];
  if (!step?.shot) return false;
  delete step.shot;
  doc.follow = true;
  return true;
}
export function stepHasShot(doc: Document, index = doc.step) {
  return Boolean(doc.steps[index]?.shot);
}
/**
 * Keeps the viewport camera eased toward whatever shot the teacher intends.
 *
 * This loop is the only writer while `follow` is on, and it re-reads the
 * target every frame. That matters: a target computed for an older step can
 * never keep animating after the user has moved on, because the next tick
 * simply aims at the new one. The moment a drag or wheel starts, `follow`
 * goes false and the loop stops touching the camera entirely.
 */
export function useTeachingCamera(doc: Document, target: () => Shot) {
  let frame = 0,
    last = 0,
    primed = false,
    running = false;
  function stopLoop() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    running = false;
    last = 0;
  }
  function startLoop() {
    if (running) return;
    running = true;
    last = 0;
    frame = requestAnimationFrame(tick);
  }
  function tick(now: number) {
    // A manual orbit or wheel turns `follow` off; stop the loop outright so
    // nothing keeps easing the view behind the user's back.
    if (!doc.follow) {
      stopLoop();
      return;
    }
    const dt = last ? (now - last) / 1000 : 0;
    last = now;
    const shot = target();
    if (!primed) {
      // First frame of the session: arrive exactly, with no animation.
      applyShot(doc.view, shot);
      primed = true;
    } else {
      easeShot(doc.view, shot, dt);
    }
    frame = requestAnimationFrame(tick);
  }
  watch(() => doc.follow, (on) => (on ? startLoop() : stopLoop()), {
    immediate: true,
  });
  onUnmounted(stopLoop);
}
