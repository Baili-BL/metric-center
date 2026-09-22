<script setup>
import { computed } from 'vue'
import Icon from './Icon.vue'

const props = defineProps({
  modelValue: { type: Object, required: true },
  placeholder: { type: String, default: '搜索名称 / ID' },
  showMine: { type: Boolean, default: true },
  showExact: { type: Boolean, default: true },
  showDate: { type: Boolean, default: true },
})
const emit = defineEmits(['update:modelValue'])

const kw = computed({
  get: () => props.modelValue.kw,
  set: (v) => emit('update:modelValue', { ...props.modelValue, kw: v }),
})
const exact = computed({
  get: () => props.modelValue.exact,
  set: (v) => emit('update:modelValue', { ...props.modelValue, exact: v }),
})
const onlyMine = computed({
  get: () => props.modelValue.onlyMine,
  set: (v) => emit('update:modelValue', { ...props.modelValue, onlyMine: v }),
})
const range = computed({
  get: () => (props.modelValue.dateFrom || props.modelValue.dateTo)
    ? [props.modelValue.dateFrom || undefined, props.modelValue.dateTo || undefined]
    : [],
  set: (v) => emit('update:modelValue', {
    ...props.modelValue,
    dateFrom: v?.[0] || '',
    dateTo: v?.[1] || '',
  }),
})
</script>

<template>
  <div class="filter-bar">
    <div class="ds-input" style="flex:1;min-width:160px">
      <Icon name="search" :size="13" />
      <input v-model="kw" :placeholder="placeholder" autocomplete="off">
    </div>
    <label v-if="showExact" class="only-mine">
      精准匹配
      <a-switch v-model="exact" size="small" />
    </label>
    <label v-if="showMine" class="only-mine">
      <a-checkbox v-model="onlyMine">只看我的</a-checkbox>
    </label>
    <a-range-picker
      v-if="showDate"
      v-model="range"
      size="small"
      style="width: 220px"
      shortcuts-position="left"
    />
  </div>
</template>

<style scoped>
.filter-bar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
</style>
