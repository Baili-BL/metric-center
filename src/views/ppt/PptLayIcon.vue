<script setup>
import { computed } from 'vue'
import { layoutOf } from './ppt-model'

const props = defineProps({
  id: { type: String, default: 'titleContent' },
})

const cells = computed(() => {
  const slots = layoutOf(props.id).slots || []
  if (!slots.length) return ['bar']
  return slots.map((s) => (s === 'text' ? 'text' : 'block'))
})
</script>

<template>
  <span class="lay-ico" :class="'ico-' + id" aria-hidden="true">
    <i v-for="(kind, n) in cells" :key="n" :class="kind" />
  </span>
</template>
