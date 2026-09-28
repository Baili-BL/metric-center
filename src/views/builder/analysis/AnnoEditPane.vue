<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { normalizeAnno } from '../../../charts/analysis/types'
import ColorPop from '../../../components/ColorPop.vue'
import Icon from '../../../components/Icon.vue'

const props = defineProps({
  anno: { type: Object, default: null },
  seriesList: { type: Array, default: () => [] },
  labels: { type: Array, default: () => [] },
})
const emit = defineEmits(['change', 'close', 'pick', 'cancel-pick'])

const draft = reactive(normalizeAnno(null))
const colorOpen = ref(false)
const colorField = ref('')
const colorLeft = ref(0)
const colorTop = ref(0)
const colorOrigin = ref('#2e74ff')

watch(() => props.anno, (a) => {
  if (!a) return
  Object.assign(draft, normalizeAnno(JSON.parse(JSON.stringify(a))))
}, { immediate: true, deep: true })

const mode = computed(() => draft.cfg?.mode || 'measure')
const isMeasure = computed(() => mode.value === 'measure')
const isFixedRange = computed(() => draft.cfg.rangeType === 'fixed')
const isBetween = computed(() => draft.cfg.thresholdOp === 'between')

function seriesLabel(s) {
  return s.alias || s.name
}

function commit() {
  emit('change', normalizeAnno({ ...draft, cfg: { ...draft.cfg } }))
}

function onMode(v) {
  draft.cfg.mode = v
  if (v === 'manual' && draft.dim == null) emit('pick')
  else if (v === 'measure') emit('cancel-pick')
  commit()
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
  colorOrigin.value = (field.startsWith('cfg.')
    ? draft.cfg[field.slice(4)]
    : draft[field]) || '#2e74ff'
  colorOpen.value = true
}

function onColorPick(color) {
  if (!colorField.value) return
  const c = color || colorOrigin.value
  if (colorField.value.startsWith('cfg.')) draft.cfg[colorField.value.slice(4)] = c
  else draft[colorField.value] = c
  commit()
}

function wellClass(color, off) {
  return {
    'is-empty': !color,
    'is-off': !!off,
  }
}
</script>

<template>
  <div v-if="anno" class="anno-edit-pane">
    <div class="anno-f-row">
      <span class="anno-f-label">标注名称</span>
      <input
        class="anno-f-inp"
        v-model="draft.name"
        maxlength="40"
        placeholder="标注1"
        @change="commit"
      >
    </div>

    <div class="anno-f-row">
      <span class="anno-f-label">标注模式</span>
      <div class="anno-f-radios">
        <label class="anno-f-radio is-disabled">
          <input type="radio" name="annoMode" value="rule" disabled>
          <span>拐点标注</span>
        </label>
        <label class="anno-f-radio">
          <input type="radio" name="annoMode" value="measure" :checked="mode === 'measure'" @change="onMode('measure')">
          <span>条件标注</span>
        </label>
        <label class="anno-f-radio">
          <input type="radio" name="annoMode" value="manual" :checked="mode === 'manual'" @change="onMode('manual')">
          <span>手工标注</span>
        </label>
      </div>
    </div>

    <template v-if="isMeasure">
      <div class="anno-f-row col">
        <span class="anno-f-label">区间类型</span>
        <div class="anno-f-radios" style="margin-top:2px">
          <label class="anno-f-radio">
            <input type="radio" value="fixed" v-model="draft.cfg.rangeType" @change="commit">
            <span>固定值</span>
          </label>
          <label class="anno-f-radio">
            <input type="radio" value="calculated" v-model="draft.cfg.rangeType" @change="commit">
            <span>计算值</span>
          </label>
        </div>
      </div>

      <div class="anno-f-row">
        <span class="anno-f-label">选择指标</span>
        <select class="anno-f-sel" v-model="draft.cfg.measure" @change="commit">
          <option disabled value="">请选择指标</option>
          <option v-for="s in seriesList" :key="s.name" :value="s.name">{{ seriesLabel(s) }}</option>
        </select>
      </div>

      <div class="anno-f-row">
        <span class="anno-f-label">数值区间</span>
        <div class="anno-f-inline">
          <select class="anno-f-sel sm" v-model="draft.cfg.thresholdOp" @change="commit">
            <option value=">=">≥</option>
            <option value="<=">≤</option>
            <option value=">">></option>
            <option value="<"><</option>
            <option value="=">=</option>
            <option value="between">介于</option>
          </select>
          <select
            v-if="!isFixedRange && !isBetween"
            class="anno-f-sel"
            v-model="draft.cfg.thresholdVal"
            @change="commit"
          >
            <option value="avg">平均值</option>
            <option value="median">中位数</option>
            <option value="max">最大值</option>
            <option value="min">最小值</option>
          </select>
        </div>
      </div>

      <div v-if="isFixedRange && !isBetween" class="anno-f-row">
        <span class="anno-f-label" />
        <input class="anno-f-inp" v-model="draft.cfg.customVal" placeholder="请输入值" @change="commit">
      </div>

      <div v-if="isBetween" class="anno-f-row">
        <span class="anno-f-label" />
        <div class="anno-f-inline">
          <input class="anno-f-inp" v-model="draft.cfg.betweenMin" placeholder="最小值" @change="commit">
          <span class="anno-between-sep">~</span>
          <input class="anno-f-inp" v-model="draft.cfg.betweenMax" placeholder="最大值" @change="commit">
        </div>
      </div>

      <div class="anno-f-row">
        <label class="anno-f-check">
          <input type="checkbox" v-model="draft.cfg.showLabel" @change="commit">
          <span>显示区间标签</span>
        </label>
        <input
          class="anno-f-inp"
          v-model="draft.cfg.labelText"
          maxlength="10"
          placeholder="请填写区间名。"
          @change="commit"
        >
      </div>

      <div class="anno-f-row col">
        <span class="anno-f-label">区间样式</span>
        <div class="anno-f-radios" style="margin-top:2px">
          <label class="anno-f-radio">
            <input type="radio" value="fill" v-model="draft.cfg.rangeStyle" @change="commit">
            <span>数值范围填充</span>
          </label>
          <label class="anno-f-radio">
            <input type="radio" value="line" v-model="draft.cfg.rangeStyle" @change="commit">
            <span>分割辅助线</span>
          </label>
        </div>
      </div>

      <div class="anno-f-row">
        <span class="anno-f-label">区间色</span>
        <button
          type="button"
          class="anno-color-well color-well"
          :class="wellClass(draft.cfg.rangeColor)"
          @click.stop="openColor('cfg.rangeColor', $event)"
        >
          <span class="anno-swatch" :style="{ background: draft.cfg.rangeColor || undefined }" />
          <Icon name="caret-fill" :size="8" />
        </button>
      </div>

      <div class="anno-f-row">
        <label class="anno-f-check">
          <input type="checkbox" v-model="draft.cfg.showPoint" @change="commit">
          <span>数据点颜色</span>
        </label>
        <button
          type="button"
          class="anno-color-well color-well"
          :class="wellClass(draft.cfg.pointColor, !draft.cfg.showPoint)"
          :disabled="!draft.cfg.showPoint"
          @click.stop="openColor('cfg.pointColor', $event)"
        >
          <span class="anno-swatch" :style="{ background: draft.cfg.pointColor || undefined }" />
          <Icon name="caret-fill" :size="8" />
        </button>
      </div>

      <div class="anno-f-row">
        <label class="anno-f-check">
          <input type="checkbox" v-model="draft.cfg.highlightLine" @change="commit">
          <span>连线高亮</span>
        </label>
      </div>

      <div class="anno-f-row">
        <span class="anno-f-label">作用范围</span>
        <select class="anno-f-sel" v-model="draft.cfg.scope" @change="commit">
          <option value="all">全部</option>
          <option value="current">当前指标</option>
        </select>
      </div>
    </template>

    <template v-else>
      <div class="anno-f-row">
        <span class="anno-f-label">维值</span>
        <div class="anno-f-static" :title="draft.dim ?? ''">{{ draft.dim ?? '点击图表点选' }}</div>
        <button type="button" class="anno-relink" @click="emit('pick')">重新点选</button>
      </div>
      <div class="anno-f-row">
        <span class="anno-f-label">系列</span>
        <div class="anno-f-static">{{ draft.series || '—' }}</div>
      </div>
      <div class="anno-f-row">
        <label class="anno-f-check">
          <input type="checkbox" v-model="draft.cfg.showPoint" @change="commit">
          <span>颜色</span>
        </label>
        <button
          type="button"
          class="anno-color-well color-well"
          :class="wellClass(draft.cfg.pointColorM)"
          @click.stop="openColor('cfg.pointColorM', $event)"
        >
          <span class="anno-swatch" :style="{ background: draft.cfg.pointColorM || undefined }" />
          <Icon name="caret-fill" :size="8" />
        </button>
        <label class="anno-f-check" style="margin-left:8px">
          <input type="checkbox" v-model="draft.cfg.showNote" @change="commit">
          <span>注释</span>
        </label>
      </div>
      <div class="anno-f-row">
        <span class="anno-f-label">维度背景</span>
        <button
          type="button"
          class="anno-color-well color-well"
          :class="wellClass(draft.cfg.dimBg)"
          @click.stop="openColor('cfg.dimBg', $event)"
        >
          <span class="anno-swatch" :style="{ background: draft.cfg.dimBg || undefined }" />
          <Icon name="caret-fill" :size="8" />
        </button>
        <button type="button" class="anno-relink" @click="draft.cfg.dimBg = ''; commit()">清除</button>
      </div>
      <div class="anno-f-row col" style="align-items:stretch">
        <span class="anno-f-label">描述</span>
        <textarea
          class="anno-f-ta"
          v-model="draft.text"
          maxlength="200"
          rows="3"
          placeholder="请输入描述"
          @change="commit"
        />
      </div>
    </template>

    <div class="anno-edit-actions">
      <button type="button" class="btn" @click="emit('close')">取消</button>
      <button type="button" class="btn primary" @click="emit('close')">完成</button>
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
  </div>
</template>
