<script setup lang="ts">
import { computed, ref } from "vue";
import type { Document, PoseFace } from "../../../shared/types";
import { project, polygon, cameraPoint } from "../lib/projection";
import { useFrame } from "../lib/frame";
import {
  orbit,
  zoom,
  setView,
  toggleTeachingView,
  takeOver,
} from "../model/camera";
import { downloadView } from "../lib/export";
const props = defineProps<{
  doc: Document;
  pose: PoseFace[];
  hinges: {
    id: string;
    a: [number, number, number];
    b: [number, number, number];
  }[];
}>();
defineEmits<{ select: [id: string] }>();
const svg = ref<SVGSVGElement>();
// Measure the rendered SVG itself, so the virtual scene always matches the
// box the browser actually gives us at this window width.
const frame = useFrame(svg);
const box = computed(
  () => `0 0 ${frame.value.width.toFixed(0)} ${frame.value.height}`,
);
const view = computed(() => props.doc.view);
let drag = false,
  lastX = 0,
  lastY = 0;
const faces = computed(() =>
  props.pose
    .map((f) => ({
      ...f,
      depth:
        f.points.reduce((s, p) => s + project(p, view.value, frame.value).z, 0) /
        f.points.length,
      back: cameraPoint(f.normal, view.value)[2] > 0,
    }))
    .sort((a, b) => a.depth - b.depth),
);
function down(e: PointerEvent) {
  if ((e.target as Element).closest(".hinge")) return;
  // Take over on press, not on the first move: the camera must stop easing
  // the instant the user grabs it.
  takeOver(props.doc);
  drag = true;
  lastX = e.clientX;
  lastY = e.clientY;
  (e.currentTarget as Element).setPointerCapture(e.pointerId);
}
function move(e: PointerEvent) {
  if (!drag) return;
  orbit(props.doc, e.clientX - lastX, e.clientY - lastY);
  lastX = e.clientX;
  lastY = e.clientY;
}
</script>
<template>
  <section class="viewport">
    <div class="viewport-top">
      <div class="view-tabs">
        <button class="active" @click="setView(doc, 'iso')">立体视图</button
        ><button @click="setView(doc, 'top')">俯视</button
        ><button @click="setView(doc, 'front')">正视</button>
      </div>
      <span class="live"><i></i> 实时预览</span>
    </div>
    <svg
      ref="svg"
      class="paper-scene"
      :viewBox="box"
      aria-label="三维折纸预览"
      @pointerdown="down"
      @pointermove="move"
      @pointerup="drag = false"
      @pointercancel="drag = false"
      @wheel.prevent="zoom(doc, -$event.deltaY * 0.001)"
    >
      <defs>
        <pattern id="grid" width="35" height="35" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="0.8" fill="#d4d9d0" />
        </pattern>
        <pattern
          id="fiber"
          width="13"
          height="17"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M1 2l3 1M8 11l2 -2M3 14l1 -2"
            stroke="#fff"
            stroke-opacity=".22"
            stroke-width=".7"
          />
        </pattern>
        <pattern id="dots" width="9" height="9" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r=".65" fill="#fff" fill-opacity=".4" />
        </pattern>
        <filter id="shadow"><feGaussianBlur stdDeviation="15" /></filter>
      </defs>
      <rect
        :width="frame.width"
        :height="frame.height"
        fill="#f6f7f2"
      />
      <rect
        v-if="doc.view.grid"
        :width="frame.width"
        :height="frame.height"
        fill="url(#grid)"
      />
      <ellipse
        :cx="frame.cx"
        :cy="frame.cy + frame.safe * 0.34"
        :rx="frame.safe * 0.42"
        :ry="frame.safe * 0.075"
        fill="#63705a"
        opacity=".15"
        filter="url(#shadow)"
      />
      <g v-for="f in faces" :key="f.id" :data-face="f.id">
        <polygon
          :points="polygon(f.points, view, frame)"
          :fill="f.back ? doc.back : doc.front"
          stroke="#785945"
          stroke-opacity=".35"
          stroke-width="1.2"
          stroke-linejoin="round"
        />
        <polygon
          :points="polygon(f.points, view, frame)"
          fill="#314638"
          :opacity="Math.max(0, 0.1 + f.normal[1] * 0.08)"
        />
        <polygon
          v-if="doc.texture !== 'plain'"
          :points="polygon(f.points, view, frame)"
          :fill="'url(#' + doc.texture + ')'"
        />
      </g>
      <g v-if="doc.view.wire">
        <g
          v-for="(h, i) in hinges"
          :key="h.id"
          class="hinge"
          @click.stop="$emit('select', h.id)"
        >
          <line
            :x1="project(h.a, view, frame).x"
            :y1="project(h.a, view, frame).y"
            :x2="project(h.b, view, frame).x"
            :y2="project(h.b, view, frame).y"
            stroke="transparent"
            stroke-width="18"
          />
          <line
            :x1="project(h.a, view, frame).x"
            :y1="project(h.a, view, frame).y"
            :x2="project(h.b, view, frame).x"
            :y2="project(h.b, view, frame).y"
            :stroke="h.id === doc.selected ? '#fff8d9' : '#746f57'"
            :stroke-width="h.id === doc.selected ? 2.5 : 1.2"
            stroke-dasharray="5 4"
          />
          <circle
            :cx="(project(h.a, view, frame).x + project(h.b, view, frame).x) / 2"
            :cy="(project(h.a, view, frame).y + project(h.b, view, frame).y) / 2"
            r="11"
            :fill="h.id === doc.selected ? '#384d3f' : '#f7f6ee'"
          />
          <text
            :x="(project(h.a, view, frame).x + project(h.b, view, frame).x) / 2"
            :y="(project(h.a, view, frame).y + project(h.b, view, frame).y) / 2 + 3.5"
            text-anchor="middle"
            font-size="10"
            :fill="h.id === doc.selected ? 'white' : '#555'"
          >
            {{ i + 1 }}
          </text>
        </g>
      </g>
      <g
        :transform="`translate(58,${frame.height - 85})`"
        stroke-width="1.5"
      >
        <path d="M0 0l28 12" stroke="#be806c" />
        <path d="M0 0v-30" stroke="#839b72" />
        <path d="M0 0l-18 15" stroke="#839eae" />
        <text x="32" y="17" font-size="10" fill="#ad7a69">X</text>
        <text x="-3" y="-37" font-size="10" fill="#789069">Y</text>
        <text x="-28" y="23" font-size="10" fill="#839eae">Z</text>
      </g>
    </svg>
    <div class="scene-caption">
      <span>拖动旋转视角 · 滚轮缩放</span
      ><b>{{ Math.round(doc.view.zoom * 100) }}%</b>
    </div>
    <div class="scene-tools">
      <button
        :class="{ selected: doc.view.grid }"
        title="网格"
        @click="doc.view.grid = !doc.view.grid"
      >
        ▦</button
      ><button
        :class="{ selected: doc.view.wire }"
        title="折痕"
        @click="doc.view.wire = !doc.view.wire"
      >
        ⌁</button
      ><i></i><button title="放大" @click="zoom(doc, 0.1)">＋</button
      ><button title="缩小" @click="zoom(doc, -0.1)">−</button
      ><button
        title="教学镜头 / 自由视角"
        :class="{ selected: doc.follow }"
        :aria-pressed="doc.follow"
        @click="toggleTeachingView(doc)"
      >
        ◉</button
      ><button title="重置视角" @click="setView(doc, 'iso')">⤢</button><i></i
      ><button title="下载观察图" @click="svg && downloadView(svg)">↓</button>
    </div>
  </section>
</template>
