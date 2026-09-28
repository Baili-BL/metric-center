<script setup>
import { computed, reactive, ref, watch } from 'vue'
import {
  GUIDE_LABELS,
  GUIDE_TEXT_POS,
  normalizeGuide,
} from '../../../charts/analysis/types'
import { DASH_STYLES } from '../../../charts/types'
import ColorPop from '../../../components/ColorPop.vue'

const props = defineProps({
  visible: Boolean,
  guide: { type: Object, default: null },
  seriesList: { type: Array, default: () => [] },
  dual: { type: Boolean, default: false },
})
const emit = defineEmits(['update:visible', 'ok'])

const draft = reactive(normalizeGuide(null))
const activeKeys = ref(['style'])
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

watch(() => [props.visible, props.guide], () => {
  if (!props.visible) return
  Object.assign(draft, normalizeGuide(
    props.guide ? JSON.parse(JSON.stringify(props.guide)) : null,
    props.seriesList[0]?.name || '',
  ))
})

const firstHint = computed(() => {
  const s = props.seriesList[0]
  return s ? (s.alias || s.name) : '暂无指标'
})

const isCalc = computed(() => draft.scaleMode === 'calc')
const isCustomTime = computed(() => isCalc.value && draft.timeMode === 'custom')

function seriesLabel(s) {
  return s.alias || s.name
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
  colorOrigin.value = draft[field] || '#2e74ff'
  colorOpen.value = true
}

function onColorPick(color) {
  if (!colorField.value) return
  draft[colorField.value] = color || colorOrigin.value
}

function confirm() {
  draft.mode = draft.scaleMode === 'fixed' ? 'fixed' : 'calc'
  if (draft.metricSrc === 'first' && props.seriesList[0]) {
    draft.series = props.seriesList[0].name
  }
  emit('ok', normalizeGuide({ ...draft }))
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
    :width="680"
    unmount-on-close
    ok-text="保存"
    @ok="confirm"
    @cancel="cancel"
    @update:visible="emit('update:visible', $event)"
  >
    <a-form :model="draft" layout="horizontal" auto-label-width class="an-form">
      <a-form-item label="选择坐标轴">
        <a-select v-model="draft.axis" style="width:160px">
          <a-option value="left">左轴</a-option>
          <a-option v-if="dual" value="right">右轴</a-option>
        </a-select>
      </a-form-item>

      <a-form-item label="标识线所在刻度">
        <a-space wrap>
          <a-radio-group v-model="draft.scaleMode" type="button" size="small">
            <a-radio value="fixed">固定值</a-radio>
            <a-radio value="calc">指标计算</a-radio>
          </a-radio-group>
          <a-input-number
            v-model="draft.value"
            :disabled="draft.scaleMode !== 'fixed'"
            placeholder="数值"
            style="width:120px"
          />
        </a-space>
      </a-form-item>

      <template v-if="isCalc">
        <a-form-item label="指标中心">
          <a-space direction="vertical" fill>
            <a-radio-group v-model="draft.metricSrc" direction="vertical">
              <a-radio value="first">图上第一个指标</a-radio>
              <a-radio value="other">其他指标</a-radio>
            </a-radio-group>
            <a-typography-text v-if="draft.metricSrc === 'first'" type="secondary" style="padding-left:22px">
              {{ firstHint }}
            </a-typography-text>
            <a-select
              v-model="draft.otherMetric"
              :disabled="draft.metricSrc !== 'other'"
              placeholder="请选择指标"
              allow-search
              style="width:100%"
            >
              <a-option v-for="s in seriesList" :key="s.name" :value="s.name">{{ seriesLabel(s) }}</a-option>
            </a-select>
          </a-space>
        </a-form-item>

        <a-form-item label="时间区间">
          <a-radio-group v-model="draft.timeMode" type="button" size="small">
            <a-radio value="chart">跟随图表</a-radio>
            <a-radio value="custom">自定义</a-radio>
          </a-radio-group>
        </a-form-item>

        <template v-if="isCustomTime">
          <a-form-item label="起始时间">
            <a-space wrap>
              <a-radio-group v-model="draft.startMode" type="button" size="small">
                <a-radio value="fixed">固定</a-radio>
                <a-radio value="dynamic">动态</a-radio>
              </a-radio-group>
              <a-date-picker
                v-model="draft.startDate"
                :disabled="draft.startMode !== 'fixed'"
                value-format="YYYY-MM-DD"
              />
            </a-space>
          </a-form-item>
          <a-form-item label="结束时间">
            <a-space wrap>
              <a-radio-group v-model="draft.endMode" type="button" size="small">
                <a-radio value="now">至今</a-radio>
                <a-radio value="fixed">固定</a-radio>
                <a-radio value="dynamic">动态</a-radio>
              </a-radio-group>
              <a-date-picker
                v-model="draft.endDate"
                :disabled="draft.endMode !== 'fixed'"
                value-format="YYYY-MM-DD"
              />
            </a-space>
          </a-form-item>
          <a-form-item v-if="draft.endMode === 'dynamic' || draft.startMode === 'dynamic'" label="基准日期">
            <a-space wrap>
              <a-radio-group v-model="draft.endBase" type="button" size="small">
                <a-radio value="system">系统日期</a-radio>
                <a-radio value="latest">指标最新日期</a-radio>
              </a-radio-group>
              <span class="an-muted">期数前移</span>
              <a-input-number v-model="draft.endShift" :min="0" :max="120" style="width:88px" />
              <span class="an-muted">期</span>
            </a-space>
          </a-form-item>
        </template>

        <a-form-item label="计算方式">
          <a-space direction="vertical" fill>
            <a-radio-group v-model="draft.calcMode" direction="vertical">
              <a-radio value="mean">区间均值</a-radio>
              <a-radio value="meanStd">
                <a-space :size="6">
                  <span>区间均值 加</span>
                  <a-input-number v-model="draft.stdK" :step="0.1" style="width:72px" @click.stop />
                  <span>倍 标准差</span>
                </a-space>
              </a-radio>
              <a-radio value="quantile">
                <a-space :size="6">
                  <span>区间</span>
                  <a-input-number v-model="draft.quantileP" :min="0" :max="100" style="width:72px" @click.stop />
                  <span>%</span>
                  <a-select v-model="draft.quantileKind" style="width:88px" @click.stop>
                    <a-option value="count">个数</a-option>
                    <a-option value="weight">权重</a-option>
                  </a-select>
                  <span>分位</span>
                </a-space>
              </a-radio>
            </a-radio-group>
          </a-space>
        </a-form-item>
      </template>

      <a-collapse v-model:active-key="activeKeys" :bordered="false" class="an-collapse">
        <a-collapse-item key="style" header="样式">
          <a-form-item label="线型">
            <a-select v-model="draft.dash" style="width:160px">
              <a-option v-for="d in dashOptions" :key="d.value" :value="d.value">{{ d.label }}</a-option>
            </a-select>
          </a-form-item>
          <a-form-item label="颜色">
            <button
              type="button"
              class="f-dot color-well an-color-dot"
              :style="{ background: draft.color }"
              @click.stop="openColor('color', $event)"
            />
          </a-form-item>
          <a-form-item label="粗细">
            <a-input-number v-model="draft.width" :min="1" :max="8" style="width:100px" />
          </a-form-item>
          <a-form-item label="标记线说明">
            <a-textarea v-model="draft.desc" :max-length="80" :auto-size="{ minRows: 2, maxRows: 4 }" placeholder="可选说明文字" />
          </a-form-item>
          <a-form-item label="标签">
            <a-select v-model="draft.labelMode" style="width:160px">
              <a-option v-for="l in GUIDE_LABELS" :key="l.id" :value="l.id">{{ l.name }}</a-option>
            </a-select>
          </a-form-item>
          <a-form-item label="文本位置">
            <a-select v-model="draft.textPos" style="width:160px">
              <a-option v-for="p in GUIDE_TEXT_POS" :key="p.id" :value="p.id">{{ p.name }}</a-option>
            </a-select>
          </a-form-item>
          <a-form-item label="文本颜色">
            <button
              type="button"
              class="f-dot color-well an-color-dot"
              :style="{ background: draft.textColor }"
              @click.stop="openColor('textColor', $event)"
            />
          </a-form-item>
          <a-form-item label="文本字号">
            <a-input-number v-model="draft.textSize" :min="10" :max="24" style="width:100px" />
          </a-form-item>
        </a-collapse-item>
      </a-collapse>
    </a-form>

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
