<script setup lang="ts">
import type { Document } from "../../../shared/types";
defineProps<{ doc: Document }>();
defineEmits<{
  seek: [n: number];
  play: [];
  capture: [];
  shot: [];
  camera: [];
}>();
</script>
<template>
  <section class="timeline">
    <div class="timeline-top">
      <div>
        <span class="eyebrow">折叠步骤</span><b>一步一折，慢慢成形。</b>
      </div>
      <div class="playback">
        <select v-model.number="doc.speed" aria-label="播放速度">
          <option :value="0.5">0.5×</option>
          <option :value="1">1×</option>
          <option :value="2">2×</option></select
        ><button
          class="camera-toggle"
          :class="{ selected: doc.follow }"
          :title="
            doc.follow ? '镜头跟随折痕，拖动画面可接管' : '恢复教学镜头'
          "
          :aria-pressed="doc.follow"
          @click="$emit('camera')"
        >
          ◉ 教学镜头</button
        ><button
          title="上一步"
          aria-label="上一步"
          @click="$emit('seek', doc.step - 1)"
        >
          ‹</button
        ><button class="play" aria-label="播放步骤" @click="$emit('play')">
          {{ doc.playing ? "Ⅱ" : "▶" }}</button
        ><button
          title="下一步"
          aria-label="下一步"
          @click="$emit('seek', doc.step + 1)"
        >
          ›</button
        ><button class="save-step" @click="$emit('capture')">
          保存当前步骤
        </button>
        <button
          class="save-step save-shot"
          :class="{ saved: doc.steps[doc.step]?.shot }"
          :title="
            doc.steps[doc.step]?.shot
              ? '用当前取景替换本步骤已存的镜头'
              : '把当前取景存为本步骤的镜头'
          "
          @click="$emit('shot')"
        >
          {{ doc.steps[doc.step]?.shot ? "更新镜头" : "存为镜头" }}
        </button>
      </div>
    </div>
    <div class="step-track">
      <button
        v-for="(s, i) in doc.steps"
        :key="s.id"
        :class="{ current: doc.step === i, done: doc.step > i }"
        @click="$emit('seek', i)"
      >
        <span class="step-dot">{{
          doc.step > i ? "✓" : String(i + 1).padStart(2, "0")
        }}</span><span
          ><b>{{ s.title }}</b
          ><small>{{
            i === 0
              ? "START"
              : i === doc.steps.length - 1
                ? "FINISH"
                : "FOLD " + String(i).padStart(2, "0")
          }}</small></span
        ><em
          v-if="s.shot"
          class="shot-flag"
          title="本步骤已保存镜头"
          aria-label="已保存镜头"
          >◉</em
        ><i v-if="i < doc.steps.length - 1"></i>
      </button>
    </div>
  </section>
</template>
