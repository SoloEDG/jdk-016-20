<script setup lang="ts">
import { computed } from "vue";
import type { Document } from "../../../shared/types";
import { stepHasShot } from "../model/camera";
const props = defineProps<{ doc: Document }>();
defineEmits<{ camera: []; clear: [] }>();
const saved = computed(() => stepHasShot(props.doc));
const cueTitle = computed(() => {
  const step = props.doc.steps[props.doc.cue];
  return step && props.doc.cue !== props.doc.step ? step.title : "";
});
</script>
<template>
  <section class="panel observe-panel">
    <div class="section-heading">
      <span>观察提示</span><small>INSPECT</small>
    </div>
    <div class="camera-state" :class="{ free: !doc.follow }">
      <span><i></i>{{ doc.follow ? "教学镜头" : "自由视角" }}</span>
      <small v-if="doc.follow">{{
        cueTitle ? "即将折：" + cueTitle : "围绕当前折痕取景"
      }}</small>
      <small v-else>已接管视角</small>
      <button v-if="!doc.follow" class="text-button" @click="$emit('camera')">
        恢复
      </button>
    </div>
    <div class="camera-actions">
      <span>{{ saved ? "已存本步镜头" : "本步为自动取景" }}</span>
      <button v-if="saved" class="text-button" @click="$emit('clear')">
        清除
      </button>
    </div>
    <p>换个角度，发现纸的可能。</p>
    <span class="muted small"
      >拖动画面自由旋转，检查相邻纸面的连接与折叠关系；播放时镜头围绕折轴平滑跟随。</span
    >
    <div class="legend">
      <span><i :style="{ background: doc.front }"></i>正面</span
      ><span><i :style="{ background: doc.back }"></i>背面</span
      ><span>┄ 折痕</span>
    </div>
  </section>
</template>
