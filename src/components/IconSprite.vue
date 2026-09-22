<script setup>
import { onMounted, ref } from 'vue'

const host = ref(null)

onMounted(async () => {
  try {
    const res = await fetch('/icons.svg')
    const text = await res.text()
    if (host.value) host.value.innerHTML = text
  } catch { /* sprite optional */ }
})
</script>

<template>
  <div ref="host" class="icon-sprite-host" aria-hidden="true" />
</template>

<style scoped>
.icon-sprite-host { position: absolute; width: 0; height: 0; overflow: hidden; }
</style>
