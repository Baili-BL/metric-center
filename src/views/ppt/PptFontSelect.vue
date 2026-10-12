<script setup>
import { TEXT_FONTS, filterFontOption } from './ppt-model'

defineProps({
  modelValue: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
  size: { type: String, default: 'small' },
})
const emit = defineEmits(['update:modelValue'])
</script>

<template>
  <a-select
    class="ppt-font-select"
    :model-value="modelValue"
    :disabled="disabled"
    :size="size"
    allow-search
    placeholder="所有字体"
    popup-container="body"
    :filter-option="filterFontOption"
    @change="emit('update:modelValue', $event)"
  >
    <a-option v-for="f in TEXT_FONTS" :key="f.id" :value="f.id" :label="f.name">
      <span class="ppt-font-opt" :style="{ fontFamily: f.id }">{{ f.name }}</span>
    </a-option>
  </a-select>
</template>
