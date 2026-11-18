export type Vec3 = [number, number, number];
export interface Face {
  id: string;
  points: Vec3[];
  parent?: string;
  hinge?: [Vec3, Vec3];
  crease?: string;
}
export interface Crease {
  id: string;
  name: string;
  description: string;
  face: string;
  target: number;
}
export interface Paper {
  id: string;
  name: string;
  subtitle: string;
  size: number;
  faces: Face[];
  creases: Crease[];
}
export interface Shot {
  yaw: number;
  pitch: number;
  zoom: number;
  focus: Vec3;
  radius: number;
}
export interface Step {
  id: string;
  title: string;
  note: string;
  angles: Record<string, number>;
  duration: number;
  /** Saved teaching camera. Older documents may not have one. */
  shot?: Shot;
}
export interface View {
  yaw: number;
  pitch: number;
  zoom: number;
  /** World-space look-at point. */
  focus: Vec3;
  /** World-space radius that should fit inside the viewport. */
  radius: number;
  grid: boolean;
  wire: boolean;
}
export interface Document {
  paper: Paper;
  front: string;
  back: string;
  texture: string;
  selected: string;
  angles: Record<string, number>;
  directions: Record<string, number>;
  steps: Step[];
  step: number;
  playing: boolean;
  speed: number;
  view: View;
  /** Whether the camera is following the teaching shot. */
  follow: boolean;
  /** Step whose fold is currently being taught (may be ahead of `step`). */
  cue: number;
}
export interface PoseFace {
  id: string;
  points: Vec3[];
  normal: Vec3;
}
