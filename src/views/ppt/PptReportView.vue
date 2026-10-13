<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import Icon from '../../components/Icon.vue'
import G2Chart from '../../components/G2Chart.vue'
import PptSlide from './PptSlide.vue'
import { chartFootnoteHtml, chartPaintSpec, plainNote } from './ppt-model'

const props = defineProps({
  ppt: { type: Object, required: true },
})
const emit = defineEmits(['close', 'present', 'download', 'publish'])

const pubOpen = ref(false)
const template = computed(() => props.ppt?.cover?.template || props.ppt?.coverTemplate || 'city')
const coverSlide = computed(() => {
  const hit = (props.ppt?.slides || []).find((s) => s.kind === 'cover')
  if (hit) return hit
  return { kind: 'cover', cover: props.ppt?.cover || {}, title: props.ppt?.title || '' }
})
const org = computed(() => props.ppt?.cover?.org || coverSlide.value?.cover?.org || '中辉期货有限公司')
const brandEn = computed(() => (String(org.value).includes('中辉') ? 'ZHONGHUI FUTURES' : ''))
const canPublish = computed(() => props.ppt?.scope !== 'public')
const published = computed(() => !!props.ppt?.published)
const versionLabel = computed(() => {
  const raw = String(props.ppt?.updated || props.ppt?.date || '')
  const m = raw.match(/(\d{4})[-./](\d{1,2})[-./](\d{1,2})/)
  return m ? `${Number(m[2])}.${Number(m[3])}` : '当前'
})
const pubBtnText = computed(() => `${versionLabel.value}（默认）${published.value ? '已发布' : '发布'}`)

const sections = computed(() => (props.ppt?.slides || [])
  .filter((s) => s && s.kind !== 'cover')
  .map((slide) => {
    const blocks = slide.blocks || []
    const charts = blocks.filter((b) => b?.type === 'chart' && b.builderState)
    const texts = blocks.filter((b) => b?.type === 'text' && plainNote(b.text))
    const tables = blocks.filter((b) => b?.type === 'table' && b.preview?.length)
    const sands = blocks.filter((b) => b?.type === 'sandbox' && b.cells?.length)
    return { slide, charts, texts, tables, sands }
  })
  .filter((sec) => sec.slide.title || sec.charts.length || sec.texts.length || sec.tables.length || sec.sands.length))

function specOf(block) {
  return chartPaintSpec(block, props.ppt?.style, { forReport: true })
}
function legendOf(block) {
  return (specOf(block)?.series || []).map((s) => ({
    name: s.name || s.alias || '',
    color: s.color || '#c62828',
    right: s.axis === 'right',
  })).filter((s) => s.name)
}
function footOf(block) {
  const own = block?.builderState
  if (own?.footnoteOn && plainNote(own.footnote)) return own.footnote
  return chartFootnoteHtml(block, { ...props.ppt?.style, footnote: '' })
}
function gridClass(n) {
  if (n >= 4) return 'cols-2'
  if (n === 3) return 'cols-3'
  if (n === 2) return 'cols-2'
  return 'cols-1'
}
function chgClass(n) {
  const v = Number(n)
  if (v > 0) return 'up'
  if (v < 0) return 'down'
  return ''
}
function chgText(n) {
  const v = Number(n)
  if (!Number.isFinite(v)) return '—'
  const t = Math.abs(v).toFixed(2)
  return v > 0 ? `+${t}%` : v < 0 ? `-${t}%` : '0.00%'
}
function onDoc(e) {
  if (!e.target.closest?.('.pr-pub')) pubOpen.value = false
}
onMounted(() => document.addEventListener('click', onDoc))
onBeforeUnmount(() => document.removeEventListener('click', onDoc))
</script>

<template>
  <div class="ppt-report">
    <aside class="pr-rail">
      <button type="button" class="pr-btn ghost" @click="emit('close')">返回列表</button>
      <button type="button" class="pr-btn primary" @click="emit('download', ppt)">下载</button>
      <button type="button" class="pr-btn ghost" @click="emit('present', ppt)">演示</button>
      <div class="pr-pub">
        <button type="button" class="pr-btn primary" @click.stop="pubOpen = !pubOpen">
          <span>{{ pubBtnText }}</span>
          <Icon name="chevron-down" :size="12" />
        </button>
        <div v-if="pubOpen" class="pr-pub-menu">
          <button v-if="canPublish" type="button" @click="pubOpen = false; emit('publish', ppt, !published)">
            {{ published ? '取消发布' : '发布' }}
          </button>
          <button type="button" @click="pubOpen = false; emit('present', ppt)">以 PPT 演示</button>
          <button type="button" @click="pubOpen = false; emit('download', ppt)">下载 PPTX</button>
        </div>
      </div>
    </aside>

    <header class="pr-hero">
      <PptSlide :slide="coverSlide" :template="template" :ppt-style="ppt.style" />
    </header>

    <div class="pr-article">
      <section v-for="sec in sections" :key="sec.slide.id" class="pr-sec">
        <div v-if="sec.slide.title" class="pr-sec-head">
          <div class="pr-sec-mark" aria-hidden="true"><i /><b /></div>
          <h2>{{ sec.slide.title }}</h2>
          <div class="pr-brand">
            <span class="pr-mark" aria-hidden="true"><i /><i /><i /></span>
            <div>
              <strong>{{ org }}</strong>
              <em v-if="brandEn">{{ brandEn }}</em>
            </div>
          </div>
        </div>

        <div v-if="sec.charts.length" class="pr-grid" :class="gridClass(sec.charts.length)">
          <figure v-for="(b, i) in sec.charts" :key="sec.slide.id + '-c' + i" class="pr-fig">
            <div v-if="legendOf(b).length" class="pr-legend">
              <span v-for="s in legendOf(b)" :key="s.name">
                <i :style="{ background: s.color }" />
                {{ s.name }}{{ s.right ? '(右轴)' : '' }}
              </span>
            </div>
            <div class="pr-chart" :class="{ tall: sec.charts.length === 1 }">
              <G2Chart :spec="specOf(b)" fill disable-tooltip />
            </div>
            <div v-if="footOf(b)" class="pr-foot rich-note" v-html="footOf(b)" />
          </figure>
        </div>

        <div v-for="(b, i) in sec.tables" :key="sec.slide.id + '-t' + i" class="pr-table-wrap">
          <div v-if="b.title" class="pr-cap">{{ b.title }}</div>
          <table class="pr-table">
            <tr v-for="(row, ri) in b.preview.slice(0, 16)" :key="ri">
              <td v-for="(c, ci) in row.slice(0, 8)" :key="ci">{{ typeof c === 'object' ? c.text : c }}</td>
            </tr>
          </table>
        </div>

        <div v-for="(b, i) in sec.sands" :key="sec.slide.id + '-s' + i" class="pr-sand">
          <div class="pr-cap">{{ b.title || '品种沙盘' }}</div>
          <div class="pr-sand-grid">
            <div v-for="c in b.cells || []" :key="c.name" class="pr-sand-cell" :class="chgClass(c.chg)">
              <b>{{ c.name }}</b>
              <span>{{ chgText(c.chg) }}</span>
            </div>
          </div>
        </div>

        <div
          v-for="(b, i) in sec.texts"
          :key="sec.slide.id + '-x' + i"
          class="pr-text rich-note"
          v-html="b.text"
        />
      </section>
    </div>
  </div>
</template>
