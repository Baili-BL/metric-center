<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import Icon from '../../components/Icon.vue'
import PptSlide from './PptSlide.vue'

const props = defineProps({
  ppt: { type: Object, required: true },
  start: { type: Number, default: 0 },
  preview: { type: Boolean, default: false },
})
const emit = defineEmits(['close'])
const idx = ref(props.start || 0)
const slides = computed(() => props.ppt?.slides || [])
const slide = computed(() => slides.value[idx.value] || slides.value[0])
const template = computed(() => props.ppt?.cover?.template || props.ppt?.coverTemplate || 'navy')

watch(() => props.start, (n) => { idx.value = n || 0 })

function prev() {
  idx.value = Math.max(0, idx.value - 1)
}
function next() {
  idx.value = Math.min(slides.value.length - 1, idx.value + 1)
}
function onKey(e) {
  if (e.key === 'Escape') emit('close')
  if (e.key === 'Home') { e.preventDefault(); idx.value = 0 }
  if (e.key === 'End') { e.preventDefault(); idx.value = Math.max(0, slides.value.length - 1) }
  if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp') prev()
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') {
    e.preventDefault()
    next()
  }
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="ppt-present" @click.self="emit('close')">
    <header class="pp-bar">
      <button type="button" class="pp-back" @click="emit('close')">
        <Icon name="back" :size="14" />
        <span>{{ preview ? '返回报告' : '退出演示' }}</span>
      </button>
      <span v-if="preview" class="pp-mode">PPT 演示</span>
      <span class="pp-title">{{ ppt.title }}</span>
      <button v-if="idx > 0" type="button" class="pp-from-start" @click="idx = 0">从头播放</button>
      <span class="pp-idx">{{ idx + 1 }} / {{ slides.length }}</span>
    </header>
    <div class="pp-stage">
      <button type="button" class="pp-nav prev" :disabled="idx <= 0" @click="prev"><Icon name="chevron-left" :size="16" /></button>
      <div class="pp-frame" title="点击或方向键翻页" @click="next">
        <PptSlide v-if="slide" :key="slide.id" :slide="slide" :template="template" :ppt-style="ppt.style" />
      </div>
      <button type="button" class="pp-nav next" :disabled="idx >= slides.length - 1" @click="next"><Icon name="chevron-right" :size="16" /></button>
    </div>
    <div class="pp-dots">
      <button
        v-for="(s, i) in slides"
        :key="s.id"
        type="button"
        :class="{ on: i === idx }"
        :title="s.title"
        @click="idx = i"
      />
    </div>
  </div>
</template>
