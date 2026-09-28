<script setup>
import { computed, ref, watch } from 'vue'
import { IconPlus } from '@arco-design/web-vue/es/icon'
import {
  GUIDE_LABELS,
  GUIDE_TEXT_POS,
  defaultGuide,
  normalizeGuide,
} from '../../../charts/analysis/types'
import { DASH_STYLES } from '../../../charts/types'
import ColorPop from '../../../components/ColorPop.vue'

const props = defineProps({
  visible: Boolean,
  guides: { type: Array, default: () => [] },
  seriesList: { type: Array, default: () => [] },
  dual: { type: Boolean, default: false },
})
const emit = defineEmits(['update:visible', 'ok'])

const draft = ref([])
const sel = ref(0)
const cur = computed(() => draft.value[sel.value])

const colorOpen = ref(false)
const colorField = ref('')
const colorLeft = ref(0)
const colorTop = ref(0)
const colorOrigin = ref('#2e74ff')

const dashOptions = [
  ...DASH_STYLES.map((d) => ({
    value: d.id,
    label: d.id === 'solid' ? '实线' : d.id === 'dash' ? '虚线' : '点线',
  })),
  { value: 'dashdot', label: '短虚线点' },
]

watch(() => [props.visible, props.guides], () => {
  if (!props.visible) return
  draft.value = (props.guides || []).map((g) => normalizeGuide(
    JSON.parse(JSON.stringify(g)),
    props.seriesList[0]?.name || '',
  ))
  sel.value = 0
})

function seriesLabel(name) {
  const s = props.seriesList.find((x) => x.name === name)
  return s ? (s.alias || s.name) : (name || '—')
}

function modeText(g) {
  if (g.scaleMode === 'fixed' || g.mode === 'fixed') return `固定值 ${g.value ?? ''}`
  if (g.calcMode === 'meanStd') return `均值+${g.stdK || 1}σ`
  if (g.calcMode === 'quantile') return `${g.quantileP ?? 50}%分位`
  return '区间均值'
}

function dashSvg(d) {
  return { solid: 'none', dash: '5 3', dot: '2 2', dashdot: '6 2 2 2' }[d] || 'none'
}

function addGuide() {
  draft.value.push(defaultGuide(props.seriesList[0]?.name || '', draft.value))
  sel.value = draft.value.length - 1
}

function removeGuide(i) {
  draft.value.splice(i, 1)
  if (sel.value >= draft.value.length) sel.value = Math.max(0, draft.value.length - 1)
}

function openColor(field, e) {
  const r = e.currentTarget.getBoundingClientRect()
  const width = 284
  const height = 420
  colorLeft.value = Math.min(Math.max(8, r.left), window.innerWidth - width - 8)
  let top = r.bottom + 6
  if (top + height > window.innerHeight - 8) top = Math.max(8, r.top - height - 6)
  colorTop.value = Math.round(top)
  colorField.value = field
  colorOrigin.value = cur.value?.[field] || '#2e74ff'
  colorOpen.value = true
}

function onColorPick(color) {
  if (!colorField.value || !cur.value) return
  cur.value[colorField.value] = color || colorOrigin.value
}

function confirm() {
  draft.value.forEach((g) => {
    g.mode = g.scaleMode === 'fixed' ? 'fixed' : 'calc'
    if (g.metricSrc === 'first' && props.seriesList[0]) g.series = props.seriesList[0].name
  })
  emit('ok', draft.value.map((g) => normalizeGuide(g)))
  emit('update:visible', false)
}

function cancel() {
  emit('update:visible', false)
}
</script>

<template>
  <a-modal
    :visible="visible"
    title="编辑标识线"
    :width="960"
    ok-text="保存"
    unmount-on-close
    @ok="confirm"
    @cancel="cancel"
    @update:visible="emit('update:visible', $event)"
  >
    <div class="gl-wrap">
      <!-- 左栏：标识线列表 -->
      <div class="gl-side">
        <div class="gl-side-head">
          <button type="button" class="guide-add" @click="addGuide">
            <IconPlus />
            添加标识线<span v-if="draft.length">（{{ draft.length }}）</span>
          </button>
        </div>
        <div class="gl-list">
          <div
            v-for="(g, i) in draft"
            :key="g.id"
            class="gl-li"
            :class="{ on: i === sel }"
            @click="sel = i"
          >
            <div class="gl-li-top">
              <svg width="22" height="10" class="gl-li-dash">
                <line x1="0" y1="5" x2="22" y2="5" :stroke="g.color" stroke-width="2" :stroke-dasharray="dashSvg(g.dash)" />
              </svg>
              <span class="gl-li-name">{{ g.name }}</span>
              <button class="gl-li-del" title="删除" @click.stop="removeGuide(i)">✕</button>
            </div>
            <div class="gl-li-sub">{{ seriesLabel(g.series) }} · {{ modeText(g) }} · {{ g.axis === 'right' ? '右轴' : '左轴' }}</div>
          </div>
          <div v-if="!draft.length" class="gl-empty">
            还没有标识线
          </div>
        </div>
      </div>

      <!-- 右栏：编辑表单 -->
      <div class="gl-main">
        <template v-if="cur">
          <div class="f-row">
            <span class="f-label">名称</span>
            <a-input v-model="cur.name" :max-length="30" style="width: 240px" placeholder="标识线名称" />
          </div>

          <div class="gl-sec">
            <div class="gl-sec-t">位置</div>
            <div class="f-row">
              <span class="f-label">坐标轴</span>
              <a-radio-group v-model="cur.axis" type="button" size="small">
                <a-radio value="left">左轴</a-radio>
                <a-radio v-if="dual" value="right">右轴</a-radio>
              </a-radio-group>
            </div>
            <div class="f-row">
              <span class="f-label">所在刻度</span>
              <a-radio-group v-model="cur.scaleMode" type="button" size="small">
                <a-radio value="fixed">固定值</a-radio>
                <a-radio value="calc">指标计算</a-radio>
              </a-radio-group>
              <a-input-number
                v-if="cur.scaleMode === 'fixed'"
                v-model="cur.value"
                placeholder="数值"
                style="width: 120px"
              />
            </div>

            <template v-if="cur.scaleMode === 'calc'">
              <div class="gl-card">
                <div class="f-row">
                  <span class="f-label">指标中心</span>
                  <a-radio-group v-model="cur.metricSrc" type="button" size="small">
                    <a-radio value="first">图上第一个指标</a-radio>
                    <a-radio value="other">其他指标</a-radio>
                  </a-radio-group>
                </div>
                <div class="f-row">
                  <span class="f-label">指标</span>
                  <a-select
                    v-model="cur.otherMetric"
                    :disabled="cur.metricSrc !== 'other'"
                    placeholder="请选择指标"
                    allow-search
                    style="width: 240px"
                  >
                    <a-option v-for="s in seriesList" :key="s.name" :value="s.name">{{ s.alias || s.name }}</a-option>
                  </a-select>
                </div>
                <div class="f-row">
                  <span class="f-label">时间区间</span>
                  <a-radio-group v-model="cur.timeMode" type="button" size="small">
                    <a-radio value="chart">跟随图表</a-radio>
                    <a-radio value="custom">自定义</a-radio>
                  </a-radio-group>
                </div>
                <template v-if="cur.timeMode === 'custom'">
                  <div class="f-row">
                    <span class="f-label">起始时间</span>
                    <a-radio-group v-model="cur.startMode" type="button" size="small">
                      <a-radio value="fixed">固定</a-radio>
                      <a-radio value="dynamic">动态</a-radio>
                    </a-radio-group>
                    <a-date-picker
                      v-model="cur.startDate"
                      :disabled="cur.startMode !== 'fixed'"
                      value-format="YYYY-MM-DD"
                      style="width: 140px"
                    />
                  </div>
                  <div class="f-row">
                    <span class="f-label">结束时间</span>
                    <a-radio-group v-model="cur.endMode" type="button" size="small">
                      <a-radio value="now">至今</a-radio>
                      <a-radio value="fixed">固定</a-radio>
                      <a-radio value="dynamic">动态</a-radio>
                    </a-radio-group>
                    <a-date-picker
                      v-model="cur.endDate"
                      :disabled="cur.endMode !== 'fixed'"
                      value-format="YYYY-MM-DD"
                      style="width: 140px"
                    />
                  </div>
                  <div v-if="cur.endMode === 'dynamic' || cur.startMode === 'dynamic'" class="f-row">
                    <span class="f-label">基准日期</span>
                    <a-radio-group v-model="cur.endBase" type="button" size="small">
                      <a-radio value="system">系统日期</a-radio>
                      <a-radio value="latest">指标最新日期</a-radio>
                    </a-radio-group>
                    <span class="f-muted">期数前移</span>
                    <a-input-number v-model="cur.endShift" :min="0" :max="120" style="width: 88px" />
                    <span class="f-muted">期</span>
                  </div>
                </template>
                <div class="f-row">
                  <span class="f-label">计算方式</span>
                  <a-select v-model="cur.calcMode" style="width: 240px">
                    <a-option value="mean">区间均值</a-option>
                    <a-option value="meanStd">区间均值 + N 倍标准差</a-option>
                    <a-option value="quantile">区间分位</a-option>
                  </a-select>
                  <a-input-number
                    v-if="cur.calcMode === 'meanStd'"
                    v-model="cur.stdK"
                    :step="0.1"
                    style="width: 72px"
                  />
                  <template v-if="cur.calcMode === 'meanStd'"><span class="f-muted">倍 σ</span></template>
                  <a-input-number
                    v-if="cur.calcMode === 'quantile'"
                    v-model="cur.quantileP"
                    :min="0"
                    :max="100"
                    style="width: 72px"
                  />
                  <template v-if="cur.calcMode === 'quantile'">
                    <span class="f-muted">%</span>
                    <a-select v-model="cur.quantileKind" style="width: 88px">
                      <a-option value="count">个数</a-option>
                      <a-option value="weight">权重</a-option>
                    </a-select>
                    <span class="f-muted">分位</span>
                  </template>
                </div>
              </div>
            </template>
          </div>

          <div class="gl-sec">
            <div class="gl-sec-t">样式</div>
            <div class="f-row">
              <span class="f-label">线型</span>
              <a-select v-model="cur.dash" style="width: 130px">
                <a-option v-for="d in dashOptions" :key="d.value" :value="d.value">{{ d.label }}</a-option>
              </a-select>
              <span class="f-label" style="width: auto">粗细</span>
              <a-input-number v-model="cur.width" :min="1" :max="8" style="width: 90px" />
            </div>
            <div class="f-row">
              <span class="f-label">颜色</span>
              <button
                type="button"
                class="f-dot color-well an-color-dot"
                :style="{ background: cur.color }"
                @click.stop="openColor('color', $event)"
              />
            </div>
          </div>

          <div class="gl-sec">
            <div class="gl-sec-t">标签</div>
            <div class="f-row">
              <span class="f-label">内容</span>
              <a-select v-model="cur.labelMode" style="width: 130px">
                <a-option v-for="l in GUIDE_LABELS" :key="l.id" :value="l.id">{{ l.name }}</a-option>
              </a-select>
              <span class="f-label" style="width: auto">位置</span>
              <a-select v-model="cur.textPos" style="width: 130px">
                <a-option v-for="p in GUIDE_TEXT_POS" :key="p.id" :value="p.id">{{ p.name }}</a-option>
              </a-select>
            </div>
            <div class="f-row">
              <span class="f-label">文本颜色</span>
              <button
                type="button"
                class="f-dot color-well an-color-dot"
                :style="{ background: cur.textColor }"
                @click.stop="openColor('textColor', $event)"
              />
              <span class="f-label" style="width: auto">字号</span>
              <a-input-number v-model="cur.textSize" :min="10" :max="24" style="width: 90px" />
            </div>
            <div class="f-row">
              <span class="f-label">说明</span>
              <a-textarea
                v-model="cur.desc"
                :max-length="80"
                :auto-size="{ minRows: 2, maxRows: 4 }"
                placeholder="可选说明文字"
                style="width: 320px"
              />
            </div>
          </div>
        </template>
        <div v-else class="gl-empty-main">在左侧选择或添加一条标识线</div>
      </div>
    </div>

    <Teleport to="body">
      <ColorPop
        :show="colorOpen"
        :left="colorLeft"
        :top="colorTop"
        :origin="colorOrigin"
        @update:show="colorOpen = $event"
        @pick="onColorPick"
      />
    </Teleport>
  </a-modal>
</template>

<style scoped>
.gl-wrap { display: flex; height: 540px; max-height: 64vh; }
.gl-side {
  width: 280px; flex-shrink: 0;
  background: #f7f8fa;
  border-right: 1px solid var(--border, #e5e6eb);
  display: flex; flex-direction: column; min-height: 0;
}
.gl-side-head { padding: 12px; border-bottom: 1px solid var(--border, #e5e6eb); }
.gl-side-head :deep(.guide-add) { margin-bottom: 0; }
.gl-list { flex: 1; overflow-y: auto; padding: 10px; min-height: 0; }
.gl-li {
  padding: 9px 10px; margin-bottom: 4px; border-radius: 6px; cursor: pointer;
  border: 1px solid transparent; border-left: 2px solid transparent;
  transition: background .12s;
}
.gl-li:hover { background: #f2f6ff; }
.gl-li.on { background: var(--primary-bg, #e8f3ff); border-left-color: var(--primary, #1664ff); }
.gl-li-top { display: flex; align-items: center; gap: 8px; }
.gl-li-dash { flex-shrink: 0; }
.gl-li-name {
  flex: 1; min-width: 0; font-weight: 500; font-size: 13px; color: var(--text, #1d2129);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.gl-li-del {
  display: none; border: 0; background: transparent; color: var(--text-3, #86909c);
  cursor: pointer; font-size: 12px; padding: 2px 5px; border-radius: 4px; line-height: 1;
}
.gl-li:hover .gl-li-del { display: block; }
.gl-li-del:hover { color: var(--danger, #e34d59); background: rgba(227, 77, 89, .1); }
.gl-li-sub {
  font-size: 11px; color: var(--text-3, #86909c); margin-top: 3px; padding-left: 30px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.gl-empty { text-align: center; color: var(--text-3, #86909c); font-size: 12px; padding: 48px 0; }
.gl-main { flex: 1; overflow-y: auto; padding: 18px 22px 22px; min-width: 0; }
.gl-empty-main { color: var(--text-3, #86909c); text-align: center; margin-top: 200px; font-size: 13px; }

/* 与手工配置面板同款：64px 标签 + 32px 控件 + 6px 圆角 */
.f-row { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
.f-label { width: 64px; flex-shrink: 0; color: var(--text-2, #4e5969); font-size: 12px; }
.f-muted { color: var(--text-3, #86909c); font-size: 12px; }
.gl-sec { margin-top: 18px; }
.gl-sec-t {
  display: flex; align-items: center; gap: 10px; font-weight: 500; font-size: 13px;
  color: var(--text, #1d2129); margin-bottom: 13px;
}
.gl-sec-t::after { content: ''; flex: 1; height: 1px; background: var(--border, #e5e6eb); }
.gl-card {
  background: #f7f8fa; border: 1px solid #f0f1f4; border-radius: 6px;
  padding: 12px 14px; margin: 2px 0 12px 74px;
}
.gl-card .f-row:last-child { margin-bottom: 0; }

/* Arco 控件外观向 builder 看齐：6px 圆角、32px 高、聚焦主色 */
.gl-main :deep(.arco-input-wrapper),
.gl-main :deep(.arco-select-view-single),
.gl-main :deep(.arco-select-view-multiple),
.gl-main :deep(.arco-input-number),
.gl-main :deep(.arco-picker) { border-radius: 6px; }
.gl-main :deep(.arco-input-wrapper .arco-input),
.gl-main :deep(.arco-select-view-single .arco-select-view-input),
.gl-main :deep(.arco-picker .arco-picker-input input) { font-size: 13px; }
.gl-main :deep(.arco-input-wrapper:focus-within),
.gl-main :deep(.arco-select-view-single:focus-within),
.gl-main :deep(.arco-picker:focus-within) { border-color: var(--primary, #1664ff); background-color: #fff; }
.gl-main :deep(.arco-radio-group-button) { border-radius: 6px; overflow: hidden; }
.gl-main :deep(.arco-radio-button) {
  border: 1px solid var(--border, #e5e6eb); background: #fff; color: var(--text-2, #4e5969);
  padding: 0 12px; height: 28px; line-height: 26px; font-size: 12px;
}
.gl-main :deep(.arco-radio-button:not(:first-child)) { margin-left: -1px; }
.gl-main :deep(.arco-radio-button.arco-radio-checked) {
  background: var(--primary, #1664ff); border-color: var(--primary, #1664ff); color: #fff;
  position: relative; z-index: 1;
}
.gl-main :deep(.arco-radio-button-content) { font-size: 12px; }
.gl-main :deep(.arco-radio-target) { display: none; }
</style>
