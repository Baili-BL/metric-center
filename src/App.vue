<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import AppShell from './layouts/AppShell.vue'
import IconSprite from './components/IconSprite.vue'
import NameOvTip from './components/NameOvTip.vue'

const route = useRoute()
const bare = computed(() => {
  const q = route.query || {}
  return q.preview === '1' || q.export === '1' || q.embed === '1'
})
</script>

<template>
  <IconSprite />
  <NameOvTip />
  <div v-if="bare" class="bare-root">
    <router-view />
  </div>
  <AppShell v-else />
</template>
