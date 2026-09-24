<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import Icon from '../../components/Icon.vue'
import {
  DIM_SORT_MODES,
  NULL_MODES,
  TIME_DIM_FORMATS,
  dimChipLabel,
} from '../../charts/fieldFmt'

const props = defineProps({
  state: { type: Object, required: true },
})

const open = ref(false)
const openSub = ref('')
const chipEl = ref(null)
const menuEl = ref(null)
const label = computed(() => dimChipLabel(props.state))

function place() {
  const chip = chipEl.value
  const menu = menuEl.value
  if (!chip || !menu) return
  const r = chip.getBoundingClientRect()
  menu.style.left = `${r.left}px`
  menu.style.top = `${r.bottom + 4}px`
}

function toggle() {
  open.value = !open.value
  openSub.value = ''
  if (open.value) nextTick(place)
}

function onDoc(e) {
  if (chipEl.value?.contains(e.target) || menuEl.value?.contains(e.target)) return
  open.value = false
  openSub.value = ''
}

onMounted(() => {
  document.addEventListener('click', onDoc)
  window.addEventListener('resize', () => { if (open.value) place() })
})
onBeforeUnmount(() => {
  document.removeEventListener('click', onDoc)
})
</script>

<template>
  <button ref="chipEl" type="button" class="dim-chip" :class="{ open }" @click.stop="toggle">
    <span class="dim-ico"><Icon name="calendar" :size="13" /></span>
    <span class="dim-name">{{ label }}</span>
    <span class="dim-caret"><Icon name="caret-fill" :size="10" /></span>
  </button>
  <Teleport to="body">
    <div v-if="open" ref="menuEl" class="dim-menu dim-time-menu show">
      <div class="dim-mi" :class="{ open: openSub === 'fmt' }" @click.stop="openSub = openSub === 'fmt' ? '' : 'fmt'">
        <span class="dim-mi-t">日期展示格式</span>
        <span class="dim-arrow"><Icon name="chevron-right" :size="10" /></span>
        <div class="dim-sub">
          <button
            v-for="x in TIME_DIM_FORMATS"
            :key="x.id"
            type="button"
            class="dim-opt"
            :class="{ active: (state.dimTimeFormat || 'auto') === x.id }"
            @click.stop="state.dimTimeFormat = x.id"
          >{{ x.label }}</button>
        </div>
      </div>
      <div class="dim-mi" :class="{ open: openSub === 'null' }" @click.stop="openSub = openSub === 'null' ? '' : 'null'">
        <span class="dim-mi-t">空值展示样式</span>
        <span class="dim-arrow"><Icon name="chevron-right" :size="10" /></span>
        <div class="dim-sub">
          <button
            v-for="x in NULL_MODES"
            :key="x.id"
            type="button"
            class="dim-opt"
            :class="{ active: (state.dimNullDisplay || 'blank') === x.id }"
            @click.stop="state.dimNullDisplay = x.id"
          >{{ x.label }}</button>
        </div>
      </div>
      <div class="dim-mi" :class="{ open: openSub === 'sort' }" @click.stop="openSub = openSub === 'sort' ? '' : 'sort'">
        <span class="dim-mi-t">排序</span>
        <span class="dim-arrow"><Icon name="chevron-right" :size="10" /></span>
        <div class="dim-sub">
          <button
            v-for="x in DIM_SORT_MODES"
            :key="x.id"
            type="button"
            class="dim-opt"
            :class="{ active: (state.dimSort || 'asc') === x.id }"
            @click.stop="state.dimSort = x.id"
          >{{ x.label }}</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
