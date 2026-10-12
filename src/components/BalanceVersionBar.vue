<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import Icon from './Icon.vue'

const props = defineProps({
  version: { type: Object, required: true },
})
const emit = defineEmits(['update:version', 'refresh'])

const open = ref(false)
const label = computed(() => {
  if (props.version?.mode === 'date' && props.version.date) {
    return String(props.version.date).replace(/-/g, '/')
  }
  return '动态'
})
const dateValue = computed(() => (props.version?.mode === 'date' ? (props.version.date || '') : ''))

function pickDynamic() {
  emit('update:version', { mode: 'dynamic', date: '' })
  open.value = false
}
function pickDate(val) {
  if (!val) return
  emit('update:version', { mode: 'date', date: val })
  open.value = false
}
function onDoc(e) {
  if (e.target.closest?.('.bal-ver, .arco-picker-container, .arco-trigger-popup, .arco-panel-date')) return
  open.value = false
}
onMounted(() => document.addEventListener('click', onDoc))
onBeforeUnmount(() => document.removeEventListener('click', onDoc))
</script>

<template>
  <div class="bal-ver-bar">
    <span class="bal-ver-label">版本</span>
    <div class="bal-ver gi-date" :class="{ open }">
      <button
        type="button"
        class="gi-date-btn"
        :class="{ on: version.mode === 'date' }"
        @click.stop="open = !open"
      >
        <span>{{ label }}</span>
        <Icon name="chevron-down" :size="10" />
      </button>
      <div v-if="open" class="gi-date-pop show bal-ver-pop" @click.stop>
        <button
          type="button"
          class="gi-type-item"
          :class="{ on: version.mode !== 'date' }"
          @click="pickDynamic"
        >动态</button>
        <div class="gdp-row bal-ver-date">
          <label>日期</label>
          <a-date-picker
            :model-value="dateValue"
            value-format="YYYY-MM-DD"
            placeholder="选择日期"
            size="small"
            popup-container="body"
            @change="pickDate"
          />
        </div>
      </div>
    </div>
    <button type="button" class="ts-btn bal-ver-refresh" title="按所选版本刷新数据" @click="emit('refresh')">
      刷新
    </button>
  </div>
</template>

<style scoped>
.bal-ver-bar { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.bal-ver-label { font-size: 12.5px; color: var(--text-2); flex-shrink: 0; }
.bal-ver-pop { width: 260px; left: auto; right: 0; }
.bal-ver-date { margin: 10px 0 0; }
</style>
