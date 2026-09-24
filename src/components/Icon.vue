<script setup>
defineProps({
  name: { type: String, required: true },
  size: { type: [Number, String], default: 16 },
})
</script>

<template>
  <svg class="i" :width="size" :height="size" aria-hidden="true">
    <use :href="`#i-${name}`" />
  </svg>
</template>
