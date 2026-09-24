<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import ColorPop from '../../components/ColorPop.vue'
import Icon from '../../components/Icon.vue'
import {
  FMT_PRESETS,
  NULL_MODES,
  SORT_MODES,
  comboMarkIcon,
  comboMarkLabel,
  seriesComboMark,
  seriesFmtMenuPreset,
  seriesHasCond,
} from '../../charts/fieldFmt'

const props = defineProps({
  series: { type: Object, required: true },
  index: { type: Number, required: true },
  showAxis: { type: Boolean, default: true },
  combo: { type: Boolean, default: false },
  icon: { type: String, default: '' },
})
const emit = defineEmits(['remove', 'configure', 'color', 'mark', 'fmt', 'null', 'sort'])

const menuOpen = ref(false)
const colorOpen = ref(false)
const colorLeft = ref(0)
const colorTop = ref(0)
const markOpen = ref(false)
const openSub = ref('')
const menuEl = ref(null)
const markEl = ref(null)
const itemEl = ref(null)
const markBtnEl = ref(null)

const hasCond = computed(() => seriesHasCond(props.series))
const disp = computed(() => props.series.alias || props.series.name)
const isRight = computed(() => (props.series.axis || 'left') === 'right')
const mark = computed(() => seriesComboMark(props.series))
const ico = computed(() => props.icon || (isRight.value ? 'chart-line' : 'chart-bar'))
const fmtCur = computed(() => seriesFmtMenuPreset(props.series))

function placeMenu() {
  const item = itemEl.value
  const menu = menuEl.value
  if (!item || !menu) return
  const r = item.getBoundingClientRect()
  menu.style.left = `${r.left}px`
  menu.style.top = `${r.bottom + 4}px`
}

function placeMark() {
  const btn = markBtnEl.value
  const menu = markEl.value
  if (!btn || !menu) return
  const r = btn.getBoundingClientRect()
  const mw = menu.offsetWidth || 118
  const mh = menu.offsetHeight || 110
  let left = Math.min(Math.max(8, r.right - mw), window.innerWidth - mw - 8)
  let top = r.bottom + 4
  if (top + mh > window.innerHeight - 8) top = Math.max(8, r.top - mh - 4)
  menu.style.left = `${Math.round(left)}px`
  menu.style.top = `${Math.round(top)}px`
}

function closeAll() {
  menuOpen.value = false
  markOpen.value = false
  openSub.value = ''
}

function toggleMenu() {
  colorOpen.value = false
  markOpen.value = false
  menuOpen.value = !menuOpen.value
  openSub.value = ''
  if (menuOpen.value) nextTick(placeMenu)
}

function openColor(e) {
  menuOpen.value = false
  markOpen.value = false
  const r = e.currentTarget.getBoundingClientRect()
  const width = 284
  const height = 420
  colorLeft.value = Math.min(Math.max(8, r.left), window.innerWidth - width - 8)
  let top = r.bottom + 6
  if (top + height > window.innerHeight - 8) top = Math.max(8, r.top - height - 6)
  colorTop.value = Math.round(top)
  colorOpen.value = true
}

function onFieldColor(color) {
  emit('color', props.index, color || props.series.color)
  markOpen.value = false
  menuOpen.value = !menuOpen.value
  openSub.value = ''
  if (menuOpen.value) nextTick(placeMenu)
}

function toggleMark(e) {
  e.stopPropagation()
  menuOpen.value = false
  markOpen.value = !markOpen.value
  if (markOpen.value) nextTick(placeMark)
}

function onFmt(id) {
  if (id === 'custom') {
    closeAll()
    emit('fmt', props.index, 'custom')
    return
  }
  emit('fmt', props.index, id)
}

function onDoc(e) {
  if (itemEl.value?.contains(e.target)) return
  if (menuEl.value?.contains(e.target)) return
  if (markEl.value?.contains(e.target)) return
  if (e.target.closest?.('.cp')) return
  colorOpen.value = false
  closeAll()
}

function onWin() {
  if (menuOpen.value) placeMenu()
  if (markOpen.value) placeMark()
}

onMounted(() => {
  document.addEventListener('click', onDoc)
  window.addEventListener('resize', onWin)
  document.addEventListener('scroll', closeAll, true)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', onDoc)
  window.removeEventListener('resize', onWin)
  document.removeEventListener('scroll', closeAll, true)
})
</script>

<template>
  <div
    ref="itemEl"
    class="fld-item"
    :class="{ open: menuOpen, 'has-cond': hasCond }"
    @click="toggleMenu"
  >
    <button
      type="button"
      class="f-dot color-well"
      :style="{ background: series.color }"
      title="点击更换颜色"
      @click.stop="openColor"
    />
    <span v-if="showAxis" class="f-axis" :class="{ right: isRight }">{{ isRight ? '从轴' : '主轴' }}</span>
    <button
      v-if="combo"
      ref="markBtnEl"
      type="button"
      class="f-mark"
      :class="{ open: markOpen }"
      :title="'图表类型：' + comboMarkLabel(mark)"
      @click="toggleMark"
    >
      <Icon :name="comboMarkIcon(mark)" :size="14" />
    </button>
    <button type="button" class="f-set" title="字段配置" @click.stop="toggleMenu">
      <Icon name="caret-fill" :size="12" />
    </button>
    <button type="button" class="f-del" title="移除" @click.stop="emit('remove', index)">
      <Icon name="trash-fill" :size="12" />
    </button>
  </div>

  <Teleport to="body">
    <ColorPop
      :show="colorOpen"
      :left="colorLeft"
      :top="colorTop"
      :origin="series.color"
      @update:show="colorOpen = $event"
      @pick="onFieldColor"
    />
    <div v-if="menuOpen" ref="menuEl" class="dim-menu fld-dim-menu show">
      <div class="dim-mi" :class="{ open: openSub === 'fmt' }" @click.stop="openSub = openSub === 'fmt' ? '' : 'fmt'">
        <span class="dim-mi-t">数据展示格式</span>
        <span class="dim-arrow"><Icon name="chevron-right" :size="10" /></span>
        <div class="dim-sub">
          <button
            v-for="x in FMT_PRESETS"
            :key="x.id"
            type="button"
            class="dim-opt"
            :class="{ active: fmtCur === x.id }"
            @click.stop="onFmt(x.id)"
          >{{ x.label }}</button>
        </div>
      </div>
      <div class="dim-mi" :class="{ open: openSub === 'null' }" @click.stop="openSub = openSub === 'null' ? '' : 'null'">
        <span class="dim-mi-t">空值展示格式</span>
        <span class="dim-arrow"><Icon name="chevron-right" :size="10" /></span>
        <div class="dim-sub">
          <button
            v-for="x in NULL_MODES"
            :key="x.id"
            type="button"
            class="dim-opt"
            :class="{ active: (series.nullDisplay || 'blank') === x.id }"
            @click.stop="emit('null', index, x.id)"
          >{{ x.label }}</button>
        </div>
      </div>
      <div class="dim-mi" :class="{ open: openSub === 'sort' }" @click.stop="openSub = openSub === 'sort' ? '' : 'sort'">
        <span class="dim-mi-t">排序</span>
        <span class="dim-arrow"><Icon name="chevron-right" :size="10" /></span>
        <div class="dim-sub">
          <button
            v-for="x in SORT_MODES"
            :key="x.id"
            type="button"
            class="dim-opt"
            :class="{ active: (series.sort || 'none') === x.id }"
            @click.stop="emit('sort', index, x.id)"
          >{{ x.label }}</button>
        </div>
      </div>
      <div class="dim-sep"></div>
      <button type="button" class="dim-opt" @click.stop="closeAll(); emit('configure', index)">字段配置</button>
    </div>
    <div v-if="markOpen" ref="markEl" class="f-mark-menu show">
      <button
        v-for="x in [{ id: 'bar', label: '柱形', ico: 'mark-bar' }, { id: 'line', label: '折线', ico: 'mark-line' }, { id: 'area', label: '面积', ico: 'mark-area' }]"
        :key="x.id"
        type="button"
        :class="{ active: mark === x.id }"
        @click.stop="markOpen = false; emit('mark', index, x.id)"
      >
        <Icon :name="x.ico" :size="14" />
        <span>{{ x.label }}</span>
      </button>
    </div>
  </Teleport>
</template>
