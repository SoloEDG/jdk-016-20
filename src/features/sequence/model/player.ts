import { onUnmounted } from "vue";
import type { Document } from "../../../shared/types";
import { interpolate } from "../lib/steps";
/**
 * Drives fold angles only. The camera is intentionally untouched here:
 * `doc.cue` tells the teaching-camera loop which fold is on screen, so the
 * view can keep following while the user has taken manual control of it.
 */
export function usePlayer(doc: Document) {
  let frame = 0,
    last = 0,
    elapsed = 0,
    start: Record<string, number> = {},
    target = 0;
  function stop() {
    doc.playing = false;
    cancelAnimationFrame(frame);
    last = 0;
  }
  function tick(now: number) {
    if (!doc.playing) {
      last = 0;
      return;
    }
    if (!last) {
      last = now;
      start = { ...doc.angles };
      target = (doc.step + 1) % doc.steps.length;
      doc.cue = target;
      elapsed = 0;
    }
    elapsed += (now - last) * doc.speed;
    last = now;
    const step = doc.steps[target]!;
    doc.angles = interpolate(
      start,
      step.angles,
      Math.min(1, elapsed / step.duration),
    );
    if (elapsed >= step.duration) {
      doc.step = target;
      doc.cue = target;
      const c = doc.paper.creases[target - 1];
      if (c) doc.selected = c.id;
      if (target === doc.steps.length - 1) {
        stop();
        return;
      }
      start = { ...doc.angles };
      target = (target + 1) % doc.steps.length;
      doc.cue = target;
      elapsed = 0;
    }
    frame = requestAnimationFrame(tick);
  }
  function toggle() {
    if (doc.playing) {
      stop();
      return;
    }
    // Resuming from a pause continues the interrupted fold rather than
    // restarting it, and never rewinds the camera.
    doc.playing = true;
    doc.cue = (doc.step + 1) % doc.steps.length;
    cancelAnimationFrame(frame);
    last = 0;
    frame = requestAnimationFrame(tick);
  }
  onUnmounted(() => cancelAnimationFrame(frame));
  return { toggle };
}
