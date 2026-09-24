<script setup>
import { computed, ref } from 'vue'
import { toCascaderNodes } from '../utils/dir'

const ROOT = '__root__'
const props = defineProps({
  modelValue: { type: String, default: '' },
  tree: { type: Array, default: () => [] },
  placeholder: { type: String, default: '请选择目录' },
  allowRoot: { type: Boolean, default: false },
  rootLabel: { type: String, default: '根目录（一级目录）' },
})
const emit = defineEmits(['update:modelValue'])

const searching = ref(false)
const options = computed(() => {
  const nodes = toCascaderNodes(props.tree)
  if (!props.allowRoot) return nodes
  return [{ label: props.rootLabel, value: ROOT }, ...nodes]
})
const cascaderValue = computed(() => {
  if (props.allowRoot && !props.modelValue) return ROOT
  return props.modelValue || undefined
})
const triggerProps = { popupStyle: { zIndex: 5200 }, updateAtScroll: true }

function formatLabel(opts) {
  return (opts || []).map((o) => o.label).filter(Boolean).join(' / ')
}

function filterOption(input, option) {
  const q = String(input || '').trim().toLowerCase()
  if (!q) return true
  const label = String(option?.label || '').toLowerCase()
  const value = String(option?.value || '').toLowerCase()
  return label.includes(q) || value.includes(q) || value.replaceAll('/', ' / ').includes(q)
}

function onUpdate(val) {
  searching.value = false
  emit('update:modelValue', !val || val === ROOT ? '' : val)
}

function onInputValueChange(val) {
  searching.value = String(val || '').trim().length > 0
}

function onPopupVisibleChange(visible) {
  if (!visible) searching.value = false
}
</script>

<template>
  <a-cascader
    class="sc-path sc-path-cascader dir-path-picker"
    :class="{ 'is-searching': searching }"
    :model-value="cascaderValue"
    :options="options"
    :placeholder="placeholder"
    allow-search
    check-strictly
    expand-trigger="click"
    popup-container="body"
    :search-delay="0"
    :format-label="formatLabel"
    :filter-option="filterOption"
    :trigger-props="triggerProps"
    @update:model-value="onUpdate"
    @input-value-change="onInputValueChange"
    @popup-visible-change="onPopupVisibleChange"
  />
</template>
