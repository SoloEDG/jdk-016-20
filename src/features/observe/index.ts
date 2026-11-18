export { default as Viewport } from "./ui/Viewport.vue";
export { default as ObservePanel } from "./ui/ObservePanel.vue";
export {
  setView,
  orbit,
  zoom,
  takeOver,
  restoreTeachingView,
  toggleTeachingView,
  saveStepShot,
  clearStepShot,
  stepHasShot,
  useTeachingCamera,
} from "./model/camera";
export { teachingTarget, resolveStepShot } from "./model/teaching";
