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

/* 手工标注 · 维度弹窗多选（对齐 ai-lab main「选择内容」）
   弹窗只由「选择内容」按钮触发：新建标注/切换模式都不再自动弹出，避免打断编辑流程 */
const dimOpen = ref(false)
const dimKw = ref('')
const dimDraft = ref([])
const dimsArr = computed(() => {
  if (Array.isArray(draft.dims) && draft.dims.length) return draft.dims.map(String)
  if (draft.dim != null && draft.dim !== '') return [String(draft.dim)]
  return []
})

watch(() => props.anno, (a) => {
  if (!a) return
  Object.assign(draft, normalizeAnno(JSON.parse(JSON.stringify(a))))
}, { immediate: true, deep: true })

const mode = computed(() => draft.cfg?.mode || 'measure')
const isMeasure = computed(() => mode.value === 'measure')
const isFixedRange = computed(() => draft.cfg.rangeType === 'fixed')
const isBetween = computed(() => draft.cfg.thresholdOp === 'between')

const filteredDims = computed(() => {
  const kw = dimKw.value.trim().toLowerCase()
  const all = (props.labels || []).map(String)
  if (!kw) return all
  return all.filter((d) => d.toLowerCase().includes(kw))
})
const allChecked = computed(() =>
  filteredDims.value.length > 0 && filteredDims.value.every((d) => dimDraft.value.includes(d))
)

function openDimDlg() {
  dimDraft.value = dimsArr.value.slice()
  dimKw.value = ''
  dimOpen.value = true
}
function toggleDim(d, on) {
  const i = dimDraft.value.indexOf(d)
  if (on && i < 0) dimDraft.value.push(d)
  if (!on && i >= 0) dimDraft.value.splice(i, 1)
}
function toggleAll(on) {
  filteredDims.value.forEach((d) => {
    const i = dimDraft.value.indexOf(d)
    if (on && i < 0) dimDraft.value.push(d)
    if (!on && i >= 0) dimDraft.value.splice(i, 1)
  })
}
function confirmDims() {
  /* 按时间轴顺序落盘，兼容旧字段 dim */
  const picked = (props.labels || []).map(String).filter((d) => dimDraft.value.includes(d))
  draft.dims = picked
  draft.dim = picked.length ? picked[0] : null
  if (!picked.length) draft.series = ''
  commit()
  dimOpen.value = false
}

function seriesLabel(s) {
  return s.alias || s.name
}

function commit() {
  emit('change', normalizeAnno({ ...draft, cfg: { ...draft.cfg } }))
}

function onMode(v) {
  draft.cfg.mode = v
  if (v === 'measure') emit('cancel-pick')
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
        <span class="anno-f-label">选择内容</span>
        <button
          type="button"
          class="anno-dim-btn"
          :class="{ empty: !dimsArr.length }"
          :title="dimsArr.join('、')"
          @click="openDimDlg"
        >
          <span class="anno-dim-txt">{{ dimsArr.length ? dimsArr.join('、') : '请选择' }}</span>
          <Icon name="caret-fill" :size="10" />
        </button>
      </div>
      <div class="anno-f-row">
        <span class="anno-f-label">系列</span>
        <div class="anno-f-static">{{ draft.series || '全部' }}</div>
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

    <!-- 手工标注 · 维度勾选弹窗 -->
    <Teleport to="body">
      <div v-if="dimOpen" class="adim-mask" @click.self="dimOpen = false">
        <div class="adim-dlg">
          <div class="adim-search">
            <Icon name="search" :size="13" />
            <input v-model="dimKw" placeholder="关键词搜索" autocomplete="off">
          </div>
          <div class="adim-list">
            <label v-for="d in filteredDims" :key="d" class="adim-item">
              <input
                type="checkbox"
                :checked="dimDraft.includes(d)"
                @change="toggleDim(d, $event.target.checked)"
              >
              <span class="dim-t">{{ d }}</span>
            </label>
            <div v-if="!filteredDims.length" class="adim-empty">未找到匹配的维值</div>
          </div>
          <div class="adim-foot">
            <label class="adim-all">
              <input type="checkbox" :checked="allChecked" @change="toggleAll($event.target.checked)">
              <span>全选</span>
            </label>
            <div class="adim-btns">
              <button type="button" class="adim-btn" @click="dimOpen = false">取消</button>
              <button type="button" class="adim-btn primary" @click="confirmDims">确定</button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
/* 手工标注 · 选择内容触发器 */
.anno-dim-btn {
  flex: 1; min-width: 0; height: 24px; padding: 0 8px;
  display: flex; align-items: center; justify-content: space-between; gap: 4px;
  border: 1px solid rgba(0, 0, 0, 0.15); border-radius: 2px; background: #fff;
  font-size: 12px; color: rgba(0, 0, 0, 0.87); cursor: pointer;
}
.anno-dim-btn:hover { border-color: var(--primary, #2e74ff); }
.anno-dim-btn .anno-dim-txt {
  flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: left;
}
.anno-dim-btn.empty .anno-dim-txt { color: rgba(0, 0, 0, 0.35); }
.anno-dim-btn svg { color: rgba(0, 0, 0, 0.45); flex-shrink: 0; }

/* 维度勾选弹窗 */
.adim-mask {
  position: fixed; inset: 0; z-index: 1060;
  background: rgba(0, 0, 0, 0.28);
  display: flex; align-items: center; justify-content: center;
}
.adim-dlg {
  width: 300px; max-width: 92vw; background: #fff; border-radius: 8px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.16); padding: 12px;
}
.adim-search {
  height: 32px; padding: 0 10px; border: 1px solid var(--border-input, #e5e6eb); border-radius: 6px;
  display: flex; align-items: center; gap: 6px; color: #86909c;
}
.adim-search:focus-within { border-color: var(--primary, #1664ff); }
.adim-search input {
  flex: 1; min-width: 0; border: none; outline: none; font-size: 12px; background: transparent; color: #1d2129;
}
.adim-search input::placeholder { color: #c9cdd4; }
.adim-list {
  max-height: 320px; overflow-y: auto; margin: 8px 0;
}
.adim-item {
  display: flex; align-items: center; gap: 8px; height: 28px; padding: 0 6px;
  font-size: 12px; color: #1d2129; cursor: pointer; border-radius: 4px;
}
.adim-item:hover { background: rgba(22, 100, 255, 0.06); }
.adim-item input { accent-color: var(--primary, #1664ff); margin: 0; flex-shrink: 0; }
.adim-item .dim-t { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.adim-empty { padding: 24px 0; text-align: center; font-size: 12px; color: #86909c; }
.adim-foot {
  display: flex; align-items: center; justify-content: space-between; padding-top: 4px;
  border-top: 1px solid #f0f1f3;
}
.adim-all { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; color: #4e5969; cursor: pointer; }
.adim-all input { accent-color: var(--primary, #1664ff); margin: 0; }
.adim-btns { display: flex; gap: 8px; }
.adim-btn {
  height: 28px; padding: 0 14px; font-size: 12px; border-radius: 4px; cursor: pointer;
  border: 1px solid var(--border-input, #e5e6eb); background: #fff; color: #4e5969;
}
.adim-btn:hover { border-color: var(--primary, #1664ff); color: var(--primary, #1664ff); }
.adim-btn.primary {
  background: var(--primary, #1664ff); border-color: var(--primary, #1664ff); color: #fff;
}
.adim-btn.primary:hover { color: #fff; filter: brightness(1.05); }
</style>
