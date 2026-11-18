import { onMounted, onUnmounted, ref, watch } from "vue";
import type { Ref } from "vue";
import { frameFor } from "../lib/projection";
import type { Frame } from "../lib/projection";
/** Track a viewport element's aspect ratio so the scene reframes on resize. */
export function useFrame(el: Ref<Element | null | undefined>): Ref<Frame> {
  const frame = ref(frameFor(4 / 3));
  let observer: ResizeObserver | null = null;
  function measure(node?: Element | null) {
    const target = node ?? el.value;
    if (!target) return;
    const box = target.getBoundingClientRect();
    if (!box.width || !box.height) return;
    frame.value = frameFor(box.width / box.height);
  }
  onMounted(() => {
    if (typeof ResizeObserver === "undefined") return;
    observer = new ResizeObserver(() => measure());
    if (el.value) observer.observe(el.value);
    measure(el.value);
  });
  watch(el, (node) => {
    measure(node);
    if (!observer || !node) return;
    observer.disconnect();
    observer.observe(node);
  });
  onUnmounted(() => observer?.disconnect());
  return frame;
}
