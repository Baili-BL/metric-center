<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import Icon from '../../components/Icon.vue'
import {
  BAR_VIS_TYPES,
  DASH_STYLES,
  FONT_SIZES,
  MARKER_SHAPES,
  PLOT_VIS_TYPES,
  isBarFamily,
  isColFamily,
  isLineFamily,
  isPie,
  isSeasonal,
  showDualAxis,
  showLinePlot,
  usesViewCtrl,
} from '../../charts/types'

const props = defineProps({
  state: { type: Object, required: true },
  palettes: { type: Array, required: true },
})
const emit = defineEmits(['palette'])

const kw = ref('')
const moreOpen = ref(false)
const palOpen = ref(false)
const dashOpen = ref(false)
const srDashOpen = ref(false)
const mkOpen = ref(false)
const srMkOpen = ref(false)
const srFieldOpen = ref(false)
const lgContentOpen = ref(false)
const axisTab = ref('x')
const srIdx = ref(0)
const openMap = reactive({
  title: false,
  note: false,
  plot: true,
  axis: true,
  legend: false,
  label: false,
  tooltip: false,
  pieTotal: false,
  series: false,
  aux: false,
    viewCtrl: true,
})

const SECS = [
  { id: 'title', kw: '标题 分割线 卡片' },
  { id: 'note', kw: '备注 尾注' },
  { id: 'plot', kw: '绘图 扇形 配色 渐变 线条 标记点 图表切换 空值 堆积 透明度 柱体 圆角 半径 合并' },
  { id: 'axis', kw: '坐标轴 X轴 Y轴 网格 刻度 标题 单位 轴标签 双Y 同步' },
  { id: 'legend', kw: '图例 位置 对齐 样式 文本' },
  { id: 'label', kw: '数据标签' },
  { id: 'tooltip', kw: '工具提示 十字线 占比' },
  { id: 'pieTotal', kw: '总计 合计 中心' },
  { id: 'series', kw: '系列 线条 标记 主轴 从轴 数据标签 最值 颜色 边框' },
  { id: 'aux', kw: '辅助 指标信息' },
  { id: 'viewCtrl', kw: '视图控件 缩略轴 滚动条 最小类别宽度' },
]

const t = computed(() => props.state.type)
const isBar = computed(() => isBarFamily(t.value))
const isPieType = computed(() => isPie(t.value))
const isDonut = computed(() => isPieType.value && props.state.pieStyle === 'donut')
const linePlot = computed(() => showLinePlot(t.value))
const colPlot = computed(() => isColFamily(t.value))
const lineVis = computed(() => isLineFamily(t.value) && t.value !== 'combo')
const canDual = computed(() => showDualAxis(t.value))
const canViewCtrl = computed(() => usesViewCtrl(t.value))
const hideNote = computed(() => isBar.value)
const plotName = computed(() => (isPieType.value ? '扇形区域' : '绘图区域'))
const labelPosOpts = computed(() => (isBar.value || isPieType.value
  ? [
    { id: 'auto', label: '自动' },
    { id: 'outside', label: '图形外侧' },
    { id: 'inside', label: '图形内侧' },
    { id: 'center', label: '居中' },
  ]
  : [
    { id: 'auto', label: '自动' },
    { id: 'upLine', label: '线上方' },
    { id: 'belowLine', label: '线下方' },
  ]))
const srLabelPosOpts = computed(() => (colPlot.value
  ? [
    { id: 'auto', label: '自动' },
    { id: 'outside', label: '图形外侧' },
    { id: 'inside', label: '图形内侧' },
    { id: 'center', label: '居中' },
  ]
  : [
    { id: 'auto', label: '自动' },
    { id: 'top', label: '点上方' },
    { id: 'bottom', label: '点下方' },
    { id: 'center', label: '居中' },
  ]))

const visibleSecs = computed(() => {
  const q = kw.value.trim().toLowerCase()
  return SECS.filter((s) => {
    if (s.id === 'note' && hideNote.value) return false
    if (s.id === 'pieTotal' && !isDonut.value) return false
    if (s.id === 'viewCtrl' && !canViewCtrl.value) return false
    if (s.id === 'axis' && isPieType.value) return false
    if (!q) return true
    return s.kw.toLowerCase().includes(q) || s.id.includes(q)
  })
})

const curAx = computed(() => props.state.ax?.[axisTab.value] || {})
const curSeries = computed(() => props.state.series[srIdx.value] || null)
const palette = computed(() => props.palettes[props.state.paletteIdx] || props.palettes[0])
const dashCss = computed(() => DASH_STYLES.find((d) => d.id === (props.state.dash === 'dotted' ? 'dot' : props.state.dash))?.css || 'solid')
const srDashCss = computed(() => {
  const id = curSeries.value?.dash || props.state.dash
  return DASH_STYLES.find((d) => d.id === (id === 'dotted' ? 'dot' : id))?.css || 'solid'
})

function showSec(id) {
  return visibleSecs.value.some((s) => s.id === id)
}
function toggleSec(id) {
  openMap[id] = !openMap[id]
}
function expandAll() {
  Object.keys(openMap).forEach((k) => { openMap[k] = true })
  moreOpen.value = false
}
function collapseAll() {
  Object.keys(openMap).forEach((k) => { openMap[k] = false })
  moreOpen.value = false
}
function setType(id) {
  props.state.type = id
  if (isColFamily(id) && !props.state.barStyleApplied) {
    props.state.barStyleApplied = true
    if (props.state.ax?.x && !props.state.ax.x.title) {
      props.state.ax.x.showTitle = true
      props.state.ax.x.title = '时间'
    }
  }
}
function setStack(on) {
  if (on) setType('stackCol')
  else if (props.state.type === 'stackCol') setType('bar')
}
function setStackPct(on) {
  if (on) setType('stackColPercent')
  else if (props.state.type === 'stackColPercent') setType('bar')
}
function setDash(id, seriesLocal) {
  if (seriesLocal && curSeries.value) curSeries.value.dash = id
  else props.state.dash = id
  dashOpen.value = false
  srDashOpen.value = false
}
function setMarker(id, seriesLocal) {
  if (seriesLocal && curSeries.value) {
    curSeries.value.markerShape = id
    curSeries.value.marker = true
  } else {
    props.state.markerShape = id
    props.state.marker = true
  }
  mkOpen.value = false
  srMkOpen.value = false
}
function pickSeries(i) {
  srIdx.value = i
  srFieldOpen.value = false
}
function onMinWidth(e) {
  const n = Number(e.target.value)
  props.state.viewCtrlMinWidth = Number.isFinite(n) ? Math.max(8, Math.min(200, Math.round(n))) : 32
}
function legendChecked(name) {
  const items = props.state.legendItems
  return !items || items.includes(name)
}
function toggleLegendItem(name) {
  const all = props.state.series.map((s) => s.alias || s.name)
  const cur = props.state.legendItems ? [...props.state.legendItems] : [...all]
  const i = cur.indexOf(name)
  if (i >= 0) cur.splice(i, 1)
  else cur.push(name)
  props.state.legendItems = cur.length === all.length ? null : cur
}
function onDoc(e) {
  if (!e.target.closest?.('.dash-select')) { dashOpen.value = false; srDashOpen.value = false }
  if (!e.target.closest?.('.mk-select')) { mkOpen.value = false; srMkOpen.value = false }
  if (!e.target.closest?.('.sr-field-select')) srFieldOpen.value = false
  if (!e.target.closest?.('.lg-content-select')) lgContentOpen.value = false
  if (!e.target.closest?.('.style-more')) moreOpen.value = false
  if (!e.target.closest?.('.palette-wrap')) palOpen.value = false
}
onMounted(() => document.addEventListener('click', onDoc))
onBeforeUnmount(() => document.removeEventListener('click', onDoc))
</script>

<template>
  <div class="style-panel" :class="{ 'is-bar-style': isBar, 'is-pie-style': isPieType }">
    <div class="style-toolbar">
      <div class="style-search">
        <Icon name="search" :size="14" />
        <input v-model="kw" type="search" placeholder="搜索" autocomplete="off">
        <div class="style-more">
          <button type="button" class="style-more-btn" title="更多" @click.stop="moreOpen = !moreOpen">
            <Icon name="more" :size="14" />
          </button>
          <div v-if="moreOpen" class="style-more-pop">
            <button type="button" @click="expandAll">展开全部</button>
            <button type="button" @click="collapseAll">收起全部</button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="showSec('title')" class="sec" :class="{ open: openMap.title }" data-sec="title">
      <div class="sec-head" @click="toggleSec('title')">
        <span class="s-arrow"><Icon name="chevron-right" :size="10" /></span>
        <span class="s-name">标题与卡片</span>
        <label v-if="!isBar" class="switch" @click.stop>
          <input type="checkbox" v-model="state.titleShow"><span class="sl"></span>
        </label>
      </div>
      <div class="sec-body">
        <div class="cfg-row"><span class="r-label">标题</span><input class="cfg-input" v-model="state.title"></div>
        <div class="cfg-row">
          <span class="r-label">文本</span>
          <div class="fmt-bar">
            <label class="fmt-color color-well" :style="{ '--swatch': state.titleColor }">A<input type="color" v-model="state.titleColor"></label>
            <input class="cfg-input fmt-size" type="number" v-model.number="state.titleSize" min="12" max="30">
            <button type="button" class="fmt-btn" :class="{ active: state.titleBold }" @click="state.titleBold = !state.titleBold"><b>B</b></button>
            <button type="button" class="fmt-btn" :class="{ active: state.titleItalic }" @click="state.titleItalic = !state.titleItalic"><i>I</i></button>
          </div>
        </div>
        <div class="cfg-row">
          <span class="r-label">对齐</span>
          <div class="pos-group">
            <button type="button" class="pos-btn" :class="{ active: state.titleAlign === 'left' }" @click="state.titleAlign = 'left'">居左</button>
            <button type="button" class="pos-btn" :class="{ active: state.titleAlign === 'center' }" @click="state.titleAlign = 'center'">居中</button>
            <button type="button" class="pos-btn" :class="{ active: state.titleAlign === 'right' }" @click="state.titleAlign = 'right'">居右</button>
          </div>
        </div>
        <div class="ax-block">
          <label class="check-line"><input type="checkbox" v-model="state.divider">显示分割线</label>
          <div v-if="state.divider" class="ax-nest">
            <div class="cfg-row">
              <span class="r-label">分割线</span>
              <div class="fmt-bar">
                <label class="fmt-swatch color-well" :style="{ background: state.dividerColor }"><input type="color" v-model="state.dividerColor"></label>
                <input class="cfg-input fmt-size" type="number" v-model.number="state.dividerWidth" min="1" max="4">
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="showSec('note')" class="sec" :class="{ open: openMap.note }" data-sec="note">
      <div class="sec-head" @click="toggleSec('note')">
        <span class="s-arrow"><Icon name="chevron-right" :size="10" /></span>
        <span class="s-name">备注与尾注</span>
      </div>
      <div class="sec-body note-body">
        <label class="check-line"><input type="checkbox" v-model="state.remarkOn">备注</label>
        <div v-if="state.remarkOn" class="ax-nest">
          <div class="cfg-row"><span class="r-label">备注内容</span><input class="cfg-input" v-model="state.remark" placeholder="点击编辑"></div>
          <div class="cfg-row">
            <span class="r-label">位置</span>
            <div class="radio-line">
              <label><input type="radio" value="afterTitle" v-model="state.remarkPos">紧跟标题</label>
              <label><input type="radio" value="chartTop" v-model="state.remarkPos">图表上方</label>
            </div>
          </div>
        </div>
        <label class="check-line"><input type="checkbox" v-model="state.footnoteOn">尾注</label>
        <div v-if="state.footnoteOn" class="ax-nest">
          <div class="cfg-row"><span class="r-label">尾注内容</span><input class="cfg-input" v-model="state.footnote" placeholder="点击编辑"></div>
        </div>
      </div>
    </div>

    <div v-if="showSec('plot')" class="sec" :class="{ open: openMap.plot }" data-sec="plot">
      <div class="sec-head" @click="toggleSec('plot')">
        <span class="s-arrow"><Icon name="chevron-right" :size="10" /></span>
        <span class="s-name">{{ plotName }}</span>
      </div>
      <div class="sec-body plot-body">
        <div class="plot-field">
          <div class="plot-label">配色设置</div>
          <div class="plot-field-body">
            <div class="palette-wrap">
              <div class="palette-row" @click.stop="palOpen = !palOpen">
                <span v-for="c in palette.colors" :key="c" class="p-c" :style="{ background: c }"></span>
                <span class="p-name">{{ palette.name }}</span>
              </div>
              <div v-if="palOpen" class="palette-list open">
                <div v-for="(p, i) in palettes" :key="p.name" class="palette-opt" @click="emit('palette', i); palOpen = false">
                  <span v-for="c in p.colors" :key="c" class="p-c" :style="{ background: c }"></span>
                  <span class="p-name">{{ p.name }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <label v-if="!isPieType" class="check-line plot-indent"><input type="checkbox" v-model="state.gradient">开启渐变效果</label>

        <template v-if="colPlot">
          <div class="plot-inline">
            <div class="plot-label-inline">透明度</div>
            <div class="plot-slider">
              <input type="range" min="0" max="100" v-model.number="state.fillOpacity">
              <div class="px-input"><input type="number" min="0" max="100" v-model.number="state.fillOpacity"><span class="px-unit">%</span></div>
            </div>
          </div>
          <div class="plot-field">
            <div class="plot-label">可视化图表切换</div>
            <div class="plot-field-body">
              <div class="vis-switch">
                <button v-for="v in BAR_VIS_TYPES" :key="v.id" type="button" class="vis-btn" :class="{ active: state.type === v.id }" :title="v.title" @click="setType(v.id)">
                  <Icon :name="v.icon" :size="26" />
                </button>
              </div>
            </div>
          </div>
          <div class="plot-inline">
            <div class="plot-label-inline">柱体宽度
              <span class="info-tip" title="柱体在类目中的占比"><Icon name="info-circle" :size="12" /></span>
            </div>
            <div class="plot-slider">
              <input type="range" min="10" max="100" v-model.number="state.barWidth">
              <div class="px-input"><input type="number" min="10" max="100" v-model.number="state.barWidth"><span class="px-unit">%</span></div>
            </div>
          </div>
          <div class="plot-inline">
            <div class="plot-label-inline">圆角</div>
            <div class="px-input">
              <input type="number" min="0" max="24" :value="state.barRadius ?? ''" @input="state.barRadius = $event.target.value === '' ? null : Number($event.target.value)">
              <span class="px-unit">px</span>
            </div>
          </div>
          <div class="plot-check-row">
            <label class="check-line"><input type="checkbox" :checked="state.type === 'stackCol'" @change="setStack($event.target.checked)">堆积</label>
            <label class="check-line"><input type="checkbox" :checked="state.type === 'stackColPercent'" @change="setStackPct($event.target.checked)">百分比堆积</label>
          </div>
        </template>

        <template v-if="isPieType">
          <div class="plot-field">
            <div class="plot-label">可视化样式切换</div>
            <div class="plot-field-body">
              <div class="vis-switch">
                <button type="button" class="vis-btn" :class="{ active: state.pieStyle === 'pie' }" title="饼形" @click="state.pieStyle = 'pie'">
                  <svg class="i" viewBox="0 0 26 26" width="26" height="26"><path d="M13 3a10 10 0 1 0 10 10H13V3z" fill="currentColor" opacity=".85"/><path d="M15.5 3.2A10 10 0 0 1 22.8 10.5H15.5V3.2z" fill="currentColor" opacity=".45"/></svg>
                </button>
                <button type="button" class="vis-btn" :class="{ active: state.pieStyle === 'donut' }" title="环形" @click="state.pieStyle = 'donut'">
                  <svg class="i" viewBox="0 0 26 26" width="26" height="26"><path d="M13 4.5a8.5 8.5 0 1 0 8.5 8.5H13V4.5z" fill="currentColor" opacity=".85"/><circle cx="13" cy="13" r="4.2" fill="#fff"/><path d="M15.2 4.7A8.5 8.5 0 0 1 21.3 10.8H15.2V4.7z" fill="currentColor" opacity=".45"/></svg>
                </button>
              </div>
            </div>
          </div>
          <div class="plot-inline">
            <div class="plot-label-inline">透明度</div>
            <div class="plot-slider">
              <input type="range" min="0" max="100" v-model.number="state.fillOpacity">
              <div class="px-input"><input type="number" min="0" max="100" v-model.number="state.fillOpacity"><span class="px-unit">%</span></div>
            </div>
          </div>
          <div class="plot-inline">
            <div class="plot-label-inline">半径占比</div>
            <div class="plot-slider">
              <input type="range" min="30" max="100" v-model.number="state.pieRadius">
              <div class="px-input"><input type="number" min="30" max="100" v-model.number="state.pieRadius"><span class="px-unit">%</span></div>
            </div>
          </div>
          <label class="check-line"><input type="checkbox" v-model="state.pieMergeOthers">合并数据为其他</label>
          <div v-if="state.pieMergeOthers" class="ax-nest">
            <div class="cfg-row"><span class="r-label">合并后的扇形数量</span><input class="cfg-input" type="number" min="2" max="50" v-model.number="state.pieMergeCount" placeholder="请输入"></div>
            <div class="cfg-row"><span class="r-label">区块名称</span><input class="cfg-input" v-model="state.pieOthersName" placeholder="其他"></div>
            <div class="cfg-row">
              <span class="r-label">区块颜色</span>
              <label class="fmt-swatch color-well" :style="{ background: state.pieOthersColor || 'conic-gradient(#eee 25%,#fff 0 50%,#eee 0 75%,#fff 0)/8px 8px' }">
                <input type="color" :value="state.pieOthersColor || '#c4c8cf'" @input="state.pieOthersColor = $event.target.value">
              </label>
            </div>
          </div>
        </template>

        <template v-if="linePlot && !isPieType">
          <div v-if="lineVis" class="plot-field">
            <div class="plot-label">可视化图表切换</div>
            <div class="plot-field-body">
              <div class="vis-switch">
                <button v-for="v in PLOT_VIS_TYPES" :key="v.id" type="button" class="vis-btn" :class="{ active: state.type === v.id }" :title="v.title" @click="setType(v.id)">
                  <Icon :name="v.icon" :size="26" />
                </button>
              </div>
            </div>
          </div>
          <div class="plot-inline">
            <div class="plot-label-inline">线条类型</div>
            <div>
              <label class="lt-radio">
                <input type="radio" value="curve" v-model="state.lineType">
                <span class="lt-ico"><Icon name="line-type" :size="14" /></span>曲线
              </label>
              <label class="lt-radio">
                <input type="radio" value="straight" v-model="state.lineType">
                <span class="lt-ico"><Icon name="line-type-2" :size="14" /></span>直线
              </label>
            </div>
          </div>
          <div class="plot-inline">
            <div class="plot-label-inline">线条样式</div>
            <div class="line-style-row">
              <div class="dash-select" :class="{ open: dashOpen }">
                <button type="button" class="dash-trigger" title="请选择" @click.stop="dashOpen = !dashOpen">
                  <span class="dash-sample" :style="{ borderTopStyle: dashCss }"></span>
                  <span class="dash-caret"><Icon name="caret-fill" :size="12" /></span>
                </button>
                <div class="dash-panel">
                  <button v-for="d in DASH_STYLES" :key="d.id" type="button" class="dash-opt" :class="{ active: (state.dash === 'dotted' ? 'dot' : state.dash) === d.id }" @click="setDash(d.id)">
                    <span class="dash-sample" :style="{ borderTopStyle: d.css }"></span>
                  </button>
                </div>
              </div>
              <div class="px-input">
                <input type="number" min="1" max="6" v-model.number="state.width" title="线宽">
                <span class="px-unit">px</span>
              </div>
            </div>
          </div>
          <div class="mk-row plot-inline">
            <label class="check-line"><input type="checkbox" v-model="state.marker">显示标记点</label>
            <div class="mk-select" :class="{ open: mkOpen }">
              <button type="button" class="mk-trigger" title="选择标记点形状" @click.stop="mkOpen = !mkOpen">
                <span class="mk-preview">{{ MARKER_SHAPES.find(m => m.id === state.markerShape)?.id === 'circleHollow' ? '○' : '●' }}</span>
                <span class="mk-caret"><Icon name="caret-fill" :size="12" /></span>
              </button>
              <div class="mk-panel">
                <button v-for="m in MARKER_SHAPES" :key="m.id" type="button" class="mk-opt" :class="{ active: state.markerShape === m.id }" @click="setMarker(m.id)">{{ m.hollow ? '○' : '●' }} {{ m.g2 }}</button>
              </div>
            </div>
          </div>
          <div class="plot-field plot-null">
            <div class="plot-label">空值处理</div>
            <div class="plot-field-body">
              <div class="radio-line">
                <label><input type="radio" value="cross" v-model="state.nullMode">直接跨过</label>
                <label><input type="radio" value="zero" v-model="state.nullMode">置为0,不断开</label>
                <label><input type="radio" value="break" v-model="state.nullMode">线条断开</label>
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>

    <div v-if="showSec('axis')" class="sec" :class="{ open: openMap.axis }" data-sec="axis">
      <div class="sec-head" @click="toggleSec('axis')">
        <span class="s-arrow"><Icon name="chevron-right" :size="10" /></span>
        <span class="s-name">坐标轴</span>
        <label class="switch" @click.stop>
          <input type="checkbox" v-model="state.axisShow"><span class="sl"></span>
        </label>
      </div>
      <div class="sec-body axis-body">
        <label v-if="canDual" class="check-line"><input type="checkbox" v-model="state.dual">显示双Y轴</label>
        <div v-if="canDual && state.dual" class="dual-sync">
          <div class="radio-col">
            <label><input type="radio" value="none" v-model="state.dualSync">不同步</label>
            <label><input type="radio" value="count" v-model="state.dualSync">刻度数量一致</label>
            <label><input type="radio" value="value" v-model="state.dualSync">刻度数量&amp;数值一致</label>
          </div>
        </div>
        <div class="axis-tabs">
          <button type="button" class="axis-tab" :class="{ active: axisTab === 'x' }" @click="axisTab = 'x'">X轴</button>
          <button type="button" class="axis-tab" :class="{ active: axisTab === 'yL' }" @click="axisTab = 'yL'">左Y轴</button>
          <button v-if="state.dual && canDual" type="button" class="axis-tab" :class="{ active: axisTab === 'yR' }" @click="axisTab = 'yR'">右Y轴</button>
        </div>
        <div v-if="curAx" class="axis-panel">
          <div class="ax-block">
            <label class="check-line"><input type="checkbox" v-model="curAx.show">显示{{ axisTab === 'x' ? 'X轴' : axisTab === 'yL' ? '左Y轴' : '右Y轴' }}</label>
          </div>
          <div v-if="axisTab !== 'x'" class="ax-block">
            <label class="check-line"><input type="checkbox" v-model="curAx.reversed">Y轴刻度翻转</label>
          </div>
          <div class="ax-block">
            <label class="check-line"><input type="checkbox" v-model="curAx.showTitle">显示标题和单位</label>
            <div v-if="curAx.showTitle" class="ax-nest">
              <div class="cfg-row"><span class="r-label">标题</span><input class="cfg-input" v-model="curAx.title" placeholder="标题名称"></div>
              <div class="cfg-row"><span class="r-label">单位</span><input class="cfg-input" v-model="curAx.unit" placeholder="单位"></div>
              <div v-if="axisTab !== 'x'" class="cfg-row">
                <span class="r-label">位置</span>
                <select class="cfg-input" v-model="curAx.titlePos">
                  <option value="top">轴上方</option>
                  <option value="outside">轴外侧</option>
                </select>
              </div>
              <div class="cfg-row">
                <span class="r-label">文本</span>
                <div class="fmt-bar">
                  <label class="fmt-color color-well" :style="{ '--swatch': curAx.titleColor }">A<input type="color" v-model="curAx.titleColor"></label>
                  <select class="cfg-input fmt-size" v-model.number="curAx.titleSize">
                    <option v-for="n in FONT_SIZES" :key="n" :value="n">{{ n }}</option>
                  </select>
                  <button type="button" class="fmt-btn" :class="{ active: curAx.titleBold }" @click="curAx.titleBold = !curAx.titleBold"><b>B</b></button>
                  <button type="button" class="fmt-btn" :class="{ active: curAx.titleItalic }" @click="curAx.titleItalic = !curAx.titleItalic"><i>I</i></button>
                </div>
              </div>
            </div>
          </div>
          <div class="ax-block">
            <label class="check-line"><input type="checkbox" v-model="curAx.showLabels">显示轴标签</label>
            <div v-if="curAx.showLabels" class="ax-nest">
              <template v-if="axisTab === 'x'">
                <div class="ax-hint">轴标签显示规则</div>
                <div class="radio-line">
                  <label><input type="radio" value="smart" v-model="curAx.labelRule">适配</label>
                  <label><input type="radio" value="sparse" v-model="curAx.labelRule">稀疏</label>
                  <label><input type="radio" value="dense" v-model="curAx.labelRule">展示最多</label>
                </div>
                <div class="cfg-row">
                  <span class="r-label">展示内容</span>
                  <select class="cfg-input" v-model="curAx.labelContent">
                    <option value="time">时间维度</option>
                    <option value="raw">原始值</option>
                    <option value="index">序号</option>
                  </select>
                </div>
              </template>
              <div class="cfg-row">
                <span class="r-label">文本</span>
                <div class="fmt-bar">
                  <label class="fmt-color color-well" :style="{ '--swatch': curAx.labelColor }">A<input type="color" v-model="curAx.labelColor"></label>
                  <select class="cfg-input fmt-size" v-model.number="curAx.labelSize">
                    <option v-for="n in FONT_SIZES" :key="n" :value="n">{{ n }}</option>
                  </select>
                  <button type="button" class="fmt-btn" :class="{ active: curAx.labelBold }" @click="curAx.labelBold = !curAx.labelBold"><b>B</b></button>
                  <button type="button" class="fmt-btn" :class="{ active: curAx.labelItalic }" @click="curAx.labelItalic = !curAx.labelItalic"><i>I</i></button>
                </div>
              </div>
            </div>
          </div>
          <div class="ax-block"><label class="check-line"><input type="checkbox" v-model="curAx.ticks">显示刻度线</label></div>
          <div class="ax-block">
            <label class="check-line"><input type="checkbox" v-model="curAx.line">显示坐标轴</label>
            <div v-if="curAx.line" class="ax-nest">
              <div class="cfg-row">
                <span class="r-label">轴线</span>
                <div class="fmt-bar">
                  <select class="cfg-input fmt-dash" v-model="curAx.lineDash">
                    <option value="solid">────</option>
                    <option value="dash">┅┅┅┅</option>
                    <option value="dot">· · ·</option>
                  </select>
                  <input class="cfg-input fmt-size" type="number" min="1" max="4" v-model.number="curAx.lineWidth">
                  <label class="fmt-swatch color-well" :style="{ background: curAx.lineColor }"><input type="color" v-model="curAx.lineColor"></label>
                </div>
              </div>
            </div>
          </div>
          <div class="ax-block">
            <label class="check-line"><input type="checkbox" v-model="curAx.grid">显示网格线</label>
            <div v-if="curAx.grid" class="ax-nest">
              <div class="cfg-row">
                <span class="r-label">网格</span>
                <div class="fmt-bar">
                  <select class="cfg-input fmt-dash" v-model="curAx.gridDash">
                    <option value="solid">────</option>
                    <option value="dash">┅┅┅┅</option>
                    <option value="dot">· · ·</option>
                  </select>
                  <input class="cfg-input fmt-size" type="number" min="1" max="4" v-model.number="curAx.gridWidth">
                  <label class="fmt-swatch color-well" :style="{ background: curAx.gridColor }"><input type="color" v-model="curAx.gridColor"></label>
                </div>
              </div>
            </div>
          </div>
          <div v-if="axisTab === 'x' && !isBar" class="ax-block">
            <label class="check-line"><input type="checkbox" v-model="curAx.zero">显示0刻度线</label>
          </div>
          <div v-if="axisTab !== 'x'" class="ax-block">
            <div class="ax-hint">轴值范围与间隔</div>
            <div class="ax-nest">
              <div class="cfg-row">
                <span class="r-label">最大值</span>
                <input class="cfg-input" v-model="curAx.maxV" placeholder="自动">
                <label class="check-line" style="margin:0"><input type="checkbox" v-model="curAx.maxAuto">自动</label>
              </div>
              <div class="cfg-row">
                <span class="r-label">最小值</span>
                <input class="cfg-input" v-model="curAx.minV" placeholder="自动">
                <label class="check-line" style="margin:0"><input type="checkbox" v-model="curAx.minAuto">自动</label>
              </div>
              <label class="check-line"><input type="checkbox" v-model="curAx.customTick">自定义间隔</label>
              <div v-if="curAx.customTick" class="ax-nest">
                <div class="radio-line">
                  <label><input type="radio" value="step" v-model="curAx.tickMode">按步长</label>
                  <input class="cfg-input sm" type="number" v-model.number="curAx.tickStep" placeholder="如 100">
                </div>
                <div class="radio-line">
                  <label><input type="radio" value="count" v-model="curAx.tickMode">按等分数量</label>
                  <input class="cfg-input sm" type="number" min="2" max="12" v-model.number="curAx.tickCount">
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="showSec('legend')" class="sec" :class="{ open: openMap.legend }" data-sec="legend">
      <div class="sec-head" @click="toggleSec('legend')">
        <span class="s-arrow"><Icon name="chevron-right" :size="10" /></span>
        <span class="s-name">图例</span>
        <div class="s-head-tools" @click.stop>
          <span class="s-preview-ico"><Icon name="monitor" :size="14" /></span>
          <label class="switch"><input type="checkbox" v-model="state.legendShow"><span class="sl"></span></label>
        </div>
      </div>
      <div class="sec-body">
        <div v-if="!isBar && !isPieType" class="cfg-row">
          <span class="r-label">样式</span>
          <select class="cfg-input" v-model="state.legendStyle">
            <option value="auto">自动</option>
            <option value="plain">平铺</option>
            <option value="column">纵向</option>
          </select>
        </div>
        <div v-if="isBar" class="cfg-row">
          <span class="r-label">内容</span>
          <div class="lg-content-select" :class="{ open: lgContentOpen }">
            <button type="button" class="lg-content-trigger" @click.stop="lgContentOpen = !lgContentOpen">
              <span>已选{{ state.legendItems ? state.legendItems.length : state.series.length }}项</span>
              <span class="dash-caret"><Icon name="caret-fill" :size="12" /></span>
            </button>
            <div class="lg-content-panel">
              <label v-for="s in state.series" :key="s.name" class="lg-content-opt">
                <input type="checkbox" :checked="legendChecked(s.alias || s.name)" @change="toggleLegendItem(s.alias || s.name)">
                <span class="lg-c-dot" :style="{ background: s.color }"></span>
                {{ s.alias || s.name }}
              </label>
              <div v-if="!state.series.length" class="lg-content-empty">暂无系列</div>
            </div>
          </div>
        </div>
        <div class="cfg-row">
          <span class="r-label">位置</span>
          <div class="lg-pos-icons">
            <button type="button" class="lg-pos-btn" :class="{ active: state.legendPos === 'top' }" title="上方" @click="state.legendPos = 'top'"><Icon name="g-76589db6" :size="16" /></button>
            <button type="button" class="lg-pos-btn" :class="{ active: state.legendPos === 'bottom' }" title="下方" @click="state.legendPos = 'bottom'"><Icon name="g-bc1827cb" :size="16" /></button>
            <button type="button" class="lg-pos-btn" :class="{ active: state.legendPos === 'left' }" title="左侧" @click="state.legendPos = 'left'"><Icon name="g-8a355566" :size="16" /></button>
            <button type="button" class="lg-pos-btn" :class="{ active: state.legendPos === 'right' }" title="右侧" @click="state.legendPos = 'right'"><Icon name="g-f0dd8be6" :size="16" /></button>
          </div>
        </div>
        <div class="cfg-row lg-align-wrap">
          <span class="r-label">对齐</span>
          <div class="seg">
            <button type="button" class="seg-btn" :class="{ active: state.legendAlign === 'flex-start' }" @click="state.legendAlign = 'flex-start'">居左</button>
            <button type="button" class="seg-btn" :class="{ active: state.legendAlign === 'center' }" @click="state.legendAlign = 'center'">居中</button>
            <button type="button" class="seg-btn" :class="{ active: state.legendAlign === 'flex-end' }" @click="state.legendAlign = 'flex-end'">居右</button>
          </div>
        </div>
        <div class="cfg-row">
          <span class="r-label">文本</span>
          <div class="fmt-bar">
            <label class="fmt-color color-well" :style="{ '--swatch': state.legendColor }">A<input type="color" v-model="state.legendColor"></label>
            <select class="cfg-input fmt-size" v-model.number="state.legendSize">
              <option v-for="n in FONT_SIZES" :key="n" :value="n">{{ n }}</option>
            </select>
            <button type="button" class="fmt-btn" :class="{ active: state.legendBold }" @click="state.legendBold = !state.legendBold"><b>B</b></button>
            <button type="button" class="fmt-btn" :class="{ active: state.legendItalic }" @click="state.legendItalic = !state.legendItalic"><i>I</i></button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="showSec('label')" class="sec" :class="{ open: openMap.label }" data-sec="label">
      <div class="sec-head" @click="toggleSec('label')">
        <span class="s-arrow"><Icon name="chevron-right" :size="10" /></span>
        <span class="s-name">数据标签</span>
        <div class="s-head-tools" @click.stop>
          <label class="switch"><input type="checkbox" v-model="state.labelShow"><span class="sl"></span></label>
        </div>
      </div>
      <div class="sec-body label-body" :class="{ 'is-off': !state.labelShow }">
        <label class="check-line">
          <input type="checkbox" v-model="state.labelFull">全量显示
          <span class="info-tip" title="开启后显示全部数据点的标签；关闭则自动隐藏互相遮挡的标签"><Icon name="info-circle" :size="12" /></span>
        </label>
        <div v-if="!state.labelFull" class="ax-nest">
          <label class="check-line"><input type="checkbox" v-model="state.labelOverlap">允许数据标签重叠</label>
        </div>
        <div class="cfg-row">
          <span class="r-label">位置</span>
          <select class="cfg-input" v-model="state.labelPos">
            <option v-for="o in labelPosOpts" :key="o.id" :value="o.id">{{ o.label }}</option>
          </select>
        </div>
        <div class="cfg-row">
          <span class="r-label">文本</span>
          <div class="fmt-bar">
            <label class="fmt-color color-well" :style="{ '--swatch': state.labelColor }">A<input type="color" v-model="state.labelColor"></label>
            <select class="cfg-input fmt-size" v-model.number="state.labelSize">
              <option v-for="n in FONT_SIZES" :key="n" :value="n">{{ n }}</option>
            </select>
            <button type="button" class="fmt-btn" :class="{ active: state.labelBold }" @click="state.labelBold = !state.labelBold"><b>B</b></button>
            <button type="button" class="fmt-btn" :class="{ active: state.labelItalic }" @click="state.labelItalic = !state.labelItalic"><i>I</i></button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="showSec('tooltip')" class="sec" :class="{ open: openMap.tooltip }" data-sec="tooltip">
      <div class="sec-head" @click="toggleSec('tooltip')">
        <span class="s-arrow"><Icon name="chevron-right" :size="10" /></span>
        <span class="s-name">工具提示</span>
        <label class="switch" @click.stop>
          <input type="checkbox" v-model="state.tooltipShow"><span class="sl"></span>
        </label>
      </div>
      <div class="sec-body">
        <div v-if="!isPieType" class="cfg-hint">开启后，悬浮图表可查看十字线与各系列数值。</div>
        <template v-else>
          <div class="plot-field">
            <div class="plot-label">内容</div>
            <div class="plot-field-body">
              <label class="check-line"><input type="checkbox" v-model="state.tooltipShare">占比</label>
              <div v-if="state.tooltipShare" class="cfg-row">
                <span class="r-label">占比小数位数</span>
                <select class="cfg-input" v-model.number="state.tooltipShareDecimals">
                  <option :value="0">0</option>
                  <option :value="1">1</option>
                  <option :value="2">2</option>
                  <option :value="3">3</option>
                  <option :value="4">4</option>
                </select>
              </div>
            </div>
          </div>
          <div class="cfg-row">
            <span class="r-label">背景色</span>
            <label class="fmt-swatch color-well" :style="{ background: state.tooltipBg }"><input type="color" v-model="state.tooltipBg"></label>
          </div>
          <div class="cfg-row">
            <span class="r-label">文本</span>
            <div class="fmt-bar">
              <label class="fmt-color color-well" :style="{ '--swatch': state.tooltipColor }">A<input type="color" v-model="state.tooltipColor"></label>
              <select class="cfg-input fmt-size" v-model.number="state.tooltipSize">
                <option v-for="n in FONT_SIZES" :key="n" :value="n">{{ n }}</option>
              </select>
              <button type="button" class="fmt-btn" :class="{ active: state.tooltipBold }" @click="state.tooltipBold = !state.tooltipBold"><b>B</b></button>
              <button type="button" class="fmt-btn" :class="{ active: state.tooltipItalic }" @click="state.tooltipItalic = !state.tooltipItalic"><i>I</i></button>
            </div>
          </div>
        </template>
      </div>
    </div>

    <div v-if="showSec('pieTotal')" class="sec" :class="{ open: openMap.pieTotal }" data-sec="pieTotal">
      <div class="sec-head" @click="toggleSec('pieTotal')">
        <span class="s-arrow"><Icon name="chevron-right" :size="10" /></span>
        <span class="s-name">总计</span>
        <label class="switch" @click.stop>
          <input type="checkbox" v-model="state.pieTotalShow"><span class="sl"></span>
        </label>
      </div>
      <div class="sec-body" :class="{ 'is-off': !state.pieTotalShow }">
        <div class="cfg-row"><span class="r-label">自定义名称</span><input class="cfg-input" v-model="state.pieTotalName" placeholder="请输入总计名"></div>
        <div class="plot-field">
          <div class="plot-label">文本样式</div>
          <div class="plot-field-body">
            <div class="cfg-row">
              <span class="r-label">名称</span>
              <div class="fmt-bar">
                <label class="fmt-color color-well" :style="{ '--swatch': state.pieTotalNameColor }">A<input type="color" v-model="state.pieTotalNameColor"></label>
                <select class="cfg-input fmt-size" v-model.number="state.pieTotalNameSize">
                  <option v-for="n in FONT_SIZES" :key="n" :value="n">{{ n }}</option>
                </select>
                <button type="button" class="fmt-btn" :class="{ active: state.pieTotalNameBold }" @click="state.pieTotalNameBold = !state.pieTotalNameBold"><b>B</b></button>
                <button type="button" class="fmt-btn" :class="{ active: state.pieTotalNameItalic }" @click="state.pieTotalNameItalic = !state.pieTotalNameItalic"><i>I</i></button>
              </div>
            </div>
            <div class="cfg-row">
              <span class="r-label">数值</span>
              <div class="fmt-bar">
                <label class="fmt-color color-well" :style="{ '--swatch': state.pieTotalValueColor }">A<input type="color" v-model="state.pieTotalValueColor"></label>
                <select class="cfg-input fmt-size" v-model.number="state.pieTotalValueSize">
                  <option v-for="n in FONT_SIZES" :key="n" :value="n">{{ n }}</option>
                </select>
                <button type="button" class="fmt-btn" :class="{ active: state.pieTotalValueBold }" @click="state.pieTotalValueBold = !state.pieTotalValueBold"><b>B</b></button>
                <button type="button" class="fmt-btn" :class="{ active: state.pieTotalValueItalic }" @click="state.pieTotalValueItalic = !state.pieTotalValueItalic"><i>I</i></button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="showSec('series')" class="sec" :class="{ open: openMap.series }" data-sec="series">
      <div class="sec-head" @click="toggleSec('series')">
        <span class="s-arrow"><Icon name="chevron-right" :size="10" /></span>
        <span class="s-name">系列设置</span>
      </div>
      <div class="sec-body series-body">
        <div class="plot-field">
          <div class="plot-label">请选择字段</div>
          <div class="sr-field-select" :class="{ open: srFieldOpen }">
            <button type="button" class="sr-field-trigger" @click.stop="srFieldOpen = !srFieldOpen">
              <span class="sr-field-dot" :style="{ background: curSeries?.color || '#ddd' }"></span>
              <span class="sr-field-name">{{ curSeries ? (curSeries.alias || curSeries.name) : '请选择' }}</span>
              <span class="dash-caret"><Icon name="caret-fill" :size="12" /></span>
            </button>
            <div class="sr-field-panel">
              <button v-for="(s, i) in state.series" :key="s.name" type="button" class="sr-field-opt" @click="pickSeries(i)">
                <span class="sr-field-dot" :style="{ background: s.color }"></span>{{ s.alias || s.name }}
              </button>
              <div v-if="!state.series.length" class="lg-content-empty">请先添加指标</div>
            </div>
          </div>
        </div>
        <template v-if="curSeries">
          <div class="plot-inline">
            <div class="plot-label-inline">颜色</div>
            <label class="fmt-swatch color-well" :style="{ background: curSeries.color }"><input type="color" v-model="curSeries.color"></label>
          </div>
          <template v-if="colPlot || isBar">
            <div class="plot-inline">
              <div class="plot-label-inline">边框颜色</div>
              <label class="fmt-swatch color-well" :style="{ background: curSeries.barStroke || '#1f2329' }"><input type="color" :value="curSeries.barStroke || '#1f2329'" @input="curSeries.barStroke = $event.target.value"></label>
            </div>
            <div class="plot-inline">
              <div class="plot-label-inline">边框宽度</div>
              <div class="px-input">
                <input type="number" min="0" max="8" v-model.number="curSeries.barStrokeWidth">
                <span class="px-unit">px</span>
              </div>
            </div>
          </template>
          <template v-if="linePlot && !isPieType">
            <div class="plot-inline">
              <div class="plot-label-inline">线条样式</div>
              <div class="line-style-row">
                <div class="dash-select" :class="{ open: srDashOpen }">
                  <button type="button" class="dash-trigger" @click.stop="srDashOpen = !srDashOpen">
                    <span class="dash-sample" :style="{ borderTopStyle: srDashCss }"></span>
                    <span class="dash-caret"><Icon name="caret-fill" :size="12" /></span>
                  </button>
                  <div class="dash-panel">
                    <button v-for="d in DASH_STYLES" :key="d.id" type="button" class="dash-opt" @click="setDash(d.id, true)">
                      <span class="dash-sample" :style="{ borderTopStyle: d.css }"></span>
                    </button>
                  </div>
                </div>
                <div class="px-input">
                  <input type="number" min="1" max="6" :value="curSeries.lineWidth ?? state.width" @input="curSeries.lineWidth = Number($event.target.value)">
                  <span class="px-unit">px</span>
                </div>
              </div>
            </div>
            <div class="mk-row plot-inline">
              <label class="check-line"><input type="checkbox" :checked="curSeries.marker ?? state.marker" @change="curSeries.marker = $event.target.checked">显示标记点</label>
              <div class="mk-select" :class="{ open: srMkOpen }">
                <button type="button" class="mk-trigger" @click.stop="srMkOpen = !srMkOpen">
                  <span class="mk-preview">●</span>
                  <span class="mk-caret"><Icon name="caret-fill" :size="12" /></span>
                </button>
                <div class="mk-panel">
                  <button v-for="m in MARKER_SHAPES" :key="m.id" type="button" class="mk-opt" @click="setMarker(m.id, true)">{{ m.hollow ? '○' : '●' }} {{ m.g2 }}</button>
                </div>
              </div>
            </div>
          </template>
          <div v-if="state.dual && canDual" class="plot-field">
            <div class="plot-label">坐标轴</div>
            <div class="plot-field-body">
              <div class="radio-line">
                <label><input type="radio" value="left" :checked="(curSeries.axis || 'left') === 'left'" @change="curSeries.axis = 'left'">主轴</label>
                <label><input type="radio" value="right" :checked="curSeries.axis === 'right'" @change="curSeries.axis = 'right'">从轴</label>
              </div>
            </div>
          </div>
          <div class="sr-block">
            <label class="check-line"><input type="checkbox" v-model="curSeries.labelShow">显示数据标签</label>
            <div v-if="curSeries.labelShow" class="sr-nest">
              <div class="cfg-row">
                <span class="r-label">位置</span>
                <select class="cfg-input" v-model="curSeries.labelPos">
                  <option v-for="o in srLabelPosOpts" :key="o.id" :value="o.id">{{ o.label }}</option>
                </select>
              </div>
              <div class="cfg-row">
                <span class="r-label">文本</span>
                <div class="fmt-bar">
                  <label class="fmt-color color-well" :style="{ '--swatch': curSeries.labelColor }">A<input type="color" v-model="curSeries.labelColor"></label>
                  <select class="cfg-input fmt-size" v-model.number="curSeries.labelSize">
                    <option v-for="n in FONT_SIZES" :key="n" :value="n">{{ n }}</option>
                  </select>
                  <button type="button" class="fmt-btn" :class="{ active: curSeries.labelBold }" @click="curSeries.labelBold = !curSeries.labelBold"><b>B</b></button>
                  <button type="button" class="fmt-btn" :class="{ active: curSeries.labelItalic }" @click="curSeries.labelItalic = !curSeries.labelItalic"><i>I</i></button>
                </div>
              </div>
            </div>
          </div>
          <div class="sr-block">
            <label class="check-line"><input type="checkbox" v-model="curSeries.minMaxShow">显示最值</label>
            <div v-if="curSeries.minMaxShow" class="sr-nest">
              <div class="cfg-row">
                <span class="r-label">位置</span>
                <select class="cfg-input" v-model="curSeries.minMaxPos">
                  <option value="auto">自动</option>
                  <option value="top">点上方</option>
                  <option value="bottom">点下方</option>
                </select>
              </div>
              <div class="cfg-row">
                <span class="r-label">内容</span>
                <div class="sr-content">
                  <label class="check-line"><input type="checkbox" v-model="curSeries.minMaxMax">最大值</label>
                  <label class="check-line"><input type="checkbox" v-model="curSeries.minMaxMin">最小值</label>
                </div>
              </div>
              <div class="cfg-row">
                <span class="r-label">背景填充</span>
                <label class="fmt-swatch color-well" :style="{ background: curSeries.minMaxFill }"><input type="color" v-model="curSeries.minMaxFill"></label>
              </div>
              <div class="cfg-row">
                <span class="r-label">文本</span>
                <div class="fmt-bar">
                  <label class="fmt-color color-well" :style="{ '--swatch': curSeries.minMaxColor }">A<input type="color" v-model="curSeries.minMaxColor"></label>
                  <select class="cfg-input fmt-size" v-model.number="curSeries.minMaxSize">
                    <option v-for="n in FONT_SIZES" :key="n" :value="n">{{ n }}</option>
                  </select>
                  <button type="button" class="fmt-btn" :class="{ active: curSeries.minMaxBold }" @click="curSeries.minMaxBold = !curSeries.minMaxBold"><b>B</b></button>
                  <button type="button" class="fmt-btn" :class="{ active: curSeries.minMaxItalic }" @click="curSeries.minMaxItalic = !curSeries.minMaxItalic"><i>I</i></button>
                </div>
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>

    <div v-if="showSec('aux')" class="sec" :class="{ open: openMap.aux }" data-sec="aux" style="border-bottom:none">
      <div class="sec-head" @click="toggleSec('aux')">
        <span class="s-arrow"><Icon name="chevron-right" :size="10" /></span>
        <span class="s-name">辅助展示</span>
      </div>
      <div class="sec-body">
        <label class="check-line"><input type="checkbox" v-model="state.tableShow">显示指标信息</label>
      </div>
    </div>

    <div v-if="showSec('viewCtrl')" class="sec" :class="{ open: openMap.viewCtrl }" data-sec="viewCtrl">
      <div class="sec-head" @click="toggleSec('viewCtrl')">
        <span class="s-arrow"><Icon name="chevron-right" :size="10" /></span>
        <span class="s-name">视图控件</span>
        <label class="switch" @click.stop>
          <input type="checkbox" v-model="state.viewCtrlShow"><span class="sl"></span>
        </label>
      </div>
      <div class="sec-body" :class="{ 'is-off': !state.viewCtrlShow }">
        <div class="cfg-row" style="align-items:flex-start">
          <span class="r-label" style="padding-top:4px">控件类型</span>
          <div class="radio-line">
            <label><input type="radio" value="slider" v-model="state.viewCtrlType">缩略轴</label>
            <label>
              <input type="radio" value="scrollbar" v-model="state.viewCtrlType">滚动条
              <span class="info-tip" title="当类目较多时，底部出现滚动条以浏览局部区间"><Icon name="info-circle" :size="12" /></span>
            </label>
          </div>
        </div>
        <div v-if="state.viewCtrlType === 'scrollbar'" class="cfg-row">
          <span class="r-label">
            最小类别宽度
            <span class="info-tip" title="每个类目占用的最小像素宽度；越小则同屏可见类目越多"><Icon name="info-circle" :size="12" /></span>
          </span>
          <div class="px-input" style="width:72px">
            <input type="number" min="8" max="200" :value="state.viewCtrlMinWidth" @change="onMinWidth">
            <span class="px-unit">px</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
