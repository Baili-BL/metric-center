<script setup>
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { Message } from '@arco-design/web-vue'
import AppModal from '../../components/AppModal.vue'
import G2Chart from '../../components/G2Chart.vue'
import Icon from '../../components/Icon.vue'
import IndPicker from './IndPicker.vue'
import { useIndicatorStore } from '../../stores/indicators'
import { useDraftStore } from '../../stores/drafts'
import { hashStr, rndSeries } from '../../utils/hash'
import '../../styles/code-dialog.css'

const DEFAULT_CODE = [
  '#调取指标数据代码：',
  'sql1 = f"""SELECT data_time,`value` FROM edb_data_ths WHERE edb_code = \'S000025546\' ORDER BY data_time DESC;"""',
  'raw = pandas_fetch_all(sql1, db)',
  '#指标计算方式代码：',
  "raw['value'] = raw['value'] + 1",
  '#日期格式转化代码：',
  'raw[\'data_time\'] = raw[\'data_time\'].apply(lambda x: x.strftime("%Y-%m-%d"))',
  '#打印运算结果代码：',
  'result = format_data(raw, "data_time", "value")',
].join('\n')

const SOURCES = ['同花顺', '手工指标', 'SMM', '郑商所', '大商所', '上期所', '中金所', '上期能源', '欧洲天然气', '上海钢联']
const TABLE_MAP = { 上海钢联: 'edb_data_mysteel', SMM: 'edb_data_smm' }

const props = defineProps({ visible: Boolean })
const emit = defineEmits(['update:visible'])
const store = useIndicatorStore()
const drafts = useDraftStore()

const pane = ref('basic')
const editor = ref(null)
const cursor = ref({ line: 1, col: 1 })
const ran = ref(false)
const note = ref('')
const exact = ref(false)
const source = ref('同花顺')
const pickName = ref('')
const form = reactive({
  code: '',
  title: '黄金收盘价_示例计算',
  cat: '自定义指标',
  freq: '日频',
  unit: '元/克',
  def: '基于指标库数据，使用 pandas 进行计算后输出标准化结果。',
  script: DEFAULT_CODE,
})
const preview = ref([])

const names = computed(() => store.cards.map((c) => c.title))
const picked = computed(() => store.cards.find((c) => c.title === pickName.value) || null)
const tableName = computed(() => TABLE_MAP[source.value] || 'edb_data_ths')
const edbCode = computed(() => {
  const id = picked.value?.srcId || picked.value?.id || 'S000025546'
  return String(id).startsWith('S') ? id : `S${String(100000000 + (hashStr(id) % 900000000)).slice(0, 9)}`
})
const fetchCode = computed(() => {
  const tbl = tableName.value
  const code = edbCode.value
  return [
    '#调取指标数据代码：',
    `sql1 = f"""SELECT data_time,\`value\` FROM ${tbl} WHERE edb_code = '${code}' ORDER BY data_time DESC;"""`,
    'raw = pandas_fetch_all(sql1, db)',
  ].join('\n')
})
const lineCount = computed(() => Math.max(1, form.script.split('\n').length))
const previewMeta = computed(() => (
  ran.value ? `format_data 输出 · 最近 ${Math.min(100, preview.value.length)} 行` : '运行试算后展示 format_data 输出'
))
const previewRows = computed(() => preview.value.slice().reverse().slice(0, 100))
const chartSpec = computed(() => ({
  type: 'line',
  spark: true,
  tooltipShow: false,
  series: [{ name: form.title || '试算', color: '#1664FF', values: preview.value.map((r) => r.value) }],
  labels: preview.value.map((r) => r.date),
  unit: form.unit,
}))
const rangeText = computed(() => {
  if (preview.value.length < 2) return ''
  return `${preview.value[0].date} ~ ${preview.value.at(-1).date}`
})

watch(() => props.visible, (v) => {
  if (!v) return
  form.code = `CD${100000 + Math.floor(Math.random() * 900000)}`
  form.title = '黄金收盘价_示例计算'
  form.cat = '自定义指标'
  form.freq = '日频'
  form.unit = '元/克'
  form.def = '基于指标库数据，使用 pandas 进行计算后输出标准化结果。'
  form.script = DEFAULT_CODE
  pane.value = 'basic'
  ran.value = false
  preview.value = []
  note.value = ''
  pickName.value = ''
  source.value = '同花顺'
  exact.value = false
  nextTick(updateCursor)
})

function close() { emit('update:visible', false) }
function updateCursor() {
  const el = editor.value
  if (!el) return
  const pos = el.selectionStart || 0
  const before = form.script.slice(0, pos)
  const lines = before.split('\n')
  cursor.value = { line: lines.length, col: (lines.at(-1) || '').length + 1 }
}
function onEditorScroll() {
  const el = editor.value
  const gutter = el?.parentElement?.previousElementSibling
  if (el && gutter) gutter.scrollTop = el.scrollTop
}
function onTab(e) {
  if (e.key !== 'Tab') return
  e.preventDefault()
  const el = e.target
  const s = el.selectionStart
  form.script = `${form.script.slice(0, s)}    ${form.script.slice(el.selectionEnd)}`
  nextTick(() => {
    el.selectionStart = el.selectionEnd = s + 4
    updateCursor()
  })
}
function tableOf(src) { return TABLE_MAP[src] || 'edb_data_ths' }
function copyFetch() {
  navigator.clipboard?.writeText(fetchCode.value)
  Message.success('已复制调取代码')
}
function insertFetch() {
  const block = fetchCode.value
  if (/#调取指标数据代码：[\s\S]*?raw = pandas_fetch_all\([^\n]+\)/.test(form.script)) {
    form.script = form.script.replace(/#调取指标数据代码：[\s\S]*?raw = pandas_fetch_all\([^\n]+\)/, block)
  } else {
    form.script = `${block}\n${form.script}`
  }
  pane.value = 'basic'
  Message.success('已插入编辑器')
}
function runTrial() {
  if (!/format_data\s*\(/.test(form.script)) {
    return Message.error('请先在代码末尾添加 result = format_data(raw, "data_time", "value")')
  }
  const m = /edb_code\s*=\s*'([^']+)'/i.exec(form.script)
  const seed = hashStr(m ? m[1] : form.title)
  const n = 36
  let values = rndSeries(seed, n, 420, 16)
  if (/raw\[['"']value['"']\]\s*=\s*raw\[['"']value['"']\]\s*\+\s*1/.test(form.script)) {
    values = values.map((v) => +(v + 1).toFixed(4))
  }
  const labels = store.LABELS.slice(-n)
  preview.value = labels.map((date, i) => ({ date, value: +Number(values[i]).toFixed(4) }))
  ran.value = true
  note.value = `pandas 演示运行完成 · 共 ${preview.value.length} 期 · 频率：${form.freq}`
  Message.success(`试算完成，共 ${preview.value.length} 期`)
}
function saveDraft() {
  drafts.add({ kind: 'calc', title: form.title || '代码运算草稿', src: '代码运算' })
  Message.success('草稿已保存（演示）')
}
function save() {
  const name = form.title.trim()
  if (!name) return Message.error('请填写指标名称')
  if (!/format_data\s*\(/.test(form.script)) {
    return Message.error('请先在代码末尾添加 result = format_data(raw, "data_time", "value")')
  }
  store.addCalc({
    title: name,
    calcType: '代码运算',
    dir: store.currentDir || '黑色建材',
    unit: form.unit,
    freq: form.freq,
    code: form.script,
    formula: 'pandas',
  })
  close()
  Message.success(`已保存并加入指标列表：${name}`)
}
</script>

<template>
  <AppModal
    :visible="visible"
    icon="warning"
    size="xl"
    flush
    :z-index="320"
    @update:visible="(v) => { if (!v) close() }"
  >
    <template #title>创建指标 <span class="cd-badge">代码运算 · pandas</span></template>
    <div class="cd-body">
      <section class="cd-form">
        <div class="cd-main-tabs">
          <button type="button" class="cd-main-tab" :class="{ on: pane === 'basic' }" @click="pane = 'basic'">基础信息</button>
          <button type="button" class="cd-main-tab" :class="{ on: pane === 'ind' }" @click="pane = 'ind'">指标信息</button>
        </div>

        <div v-show="pane === 'basic'" class="cd-pane">
          <div class="cd-row2">
            <div class="cd-field"><label>指标编码</label><input type="text" class="ro" :value="form.code" readonly></div>
            <div class="cd-field">
              <label>指标名称<span class="req">*</span></label>
              <input type="text" v-model="form.title" autocomplete="off">
            </div>
          </div>
          <div class="cd-row2">
            <div class="cd-field">
              <label>指标分类</label>
              <select v-model="form.cat">
                <option>自定义指标</option>
                <option>净值估算指标</option>
                <option>行业指标</option>
                <option>宏观指标</option>
              </select>
            </div>
            <div class="cd-field">
              <label>统计频率</label>
              <select v-model="form.freq">
                <option>日频</option><option>周频</option><option>月频</option><option>季频</option><option>年频</option>
              </select>
            </div>
          </div>
          <div class="cd-field"><label>单位</label><input type="text" v-model="form.unit" autocomplete="off"></div>
          <div class="cd-field">
            <label>业务定义</label>
            <textarea v-model="form.def" rows="2"></textarea>
          </div>
          <div class="cd-field cd-code-field">
            <label>计算代码（pandas）</label>
            <div class="cd-code-bar">
              <span class="t">Python · pandas</span>
              <span>第 {{ cursor.line }} 行，第 {{ cursor.col }} 列</span>
            </div>
            <div class="cd-codebox">
              <div class="cd-gutter" aria-hidden="true">
                <div v-for="n in lineCount" :key="n">{{ n }}</div>
              </div>
              <div class="cd-code-main">
                <textarea
                  ref="editor"
                  class="cd-editor"
                  v-model="form.script"
                  spellcheck="false"
                  autocomplete="off"
                  @keydown="onTab"
                  @keyup="updateCursor"
                  @click="updateCursor"
                  @scroll="onEditorScroll"
                />
              </div>
            </div>
            <div class="cd-fml-hint">末尾必须包含：result = format_data(raw, "data_time", "value")。Tab 缩进。可在「指标信息」中检索指标并一键插入调取代码。</div>
          </div>
        </div>

        <div v-show="pane === 'ind'" class="cd-pane scroll">
          <div class="cd-guide">
            <b>说明：</b>选择数据来源并检索指标后，展示所在表结构；可一键复制或插入调取指标代码到计算代码编辑器。
          </div>
          <div class="cd-field">
            <label>数据来源</label>
            <select v-model="source">
              <option v-for="s in SOURCES" :key="s">{{ s }}</option>
            </select>
          </div>
          <div class="cd-field">
            <label>指标ID / 指标名称</label>
            <div class="cd-ind-row">
              <IndPicker v-model="pickName" :names="names" :exact="exact" placeholder="搜索指标ID或名称" />
              <span class="cd-exact">精准匹配
                <span class="switch"><input type="checkbox" v-model="exact"><span class="sl"></span></span>
              </span>
            </div>
          </div>
          <div class="cd-query-box">
            <div class="cd-query-hd">查询结果（展示指标所在表结构及调取指标代码）</div>
            <div v-if="!picked" class="cd-empty-q">请先检索并选择一个指标</div>
            <div v-else>
              <table class="cd-schema">
                <thead><tr><th style="width:34%">表名</th><th style="width:28%">字段名</th><th>*字段说明</th></tr></thead>
                <tbody>
                  <tr>
                    <td class="mono" rowspan="3">{{ tableOf(source) }}</td>
                    <td>edb_code</td>
                    <td>{{ edbCode }} / {{ picked.title }}</td>
                  </tr>
                  <tr><td>data_time</td><td>日期</td></tr>
                  <tr><td>value</td><td>数值（{{ picked.unit || form.unit || '—' }}）</td></tr>
                </tbody>
              </table>
              <div class="cd-fetch-wrap">
                <div class="cd-fetch-bar">
                  <span class="t">调取指标代码</span>
                  <span>
                    <button type="button" class="btn tint" style="height:28px;padding:0 10px;font-size:12px" @click="copyFetch">复制</button>
                    <button type="button" class="btn primary" style="height:28px;padding:0 10px;font-size:12px;margin-left:6px" @click="insertFetch">插入编辑器</button>
                  </span>
                </div>
                <textarea class="cd-fetch-code" :value="fetchCode" readonly></textarea>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="cd-result">
        <div class="cd-r-head">
          <span class="t">试算结果</span>
          <span class="cd-r-range">{{ rangeText }}</span>
          <button type="button" class="cd-r-run" @click="runTrial">
            <Icon name="g-f248a783" :size="12" />试算
          </button>
        </div>
        <div class="cd-r-chart">
          <G2Chart v-if="preview.length" :spec="chartSpec" fill />
          <div v-else class="cd-r-empty" style="padding-top:80px">点击「试算」查看结果</div>
        </div>
        <div class="cd-preview">
          <div class="cd-preview-hd">
            <span class="t">数据预览</span>
            <span>{{ previewMeta }}</span>
          </div>
          <div class="cd-r-table-wrap">
            <table class="cd-r-table">
              <thead><tr><th style="width:140px">data_time</th><th>value</th></tr></thead>
              <tbody>
                <tr v-if="!previewRows.length"><td colspan="2"><div class="cd-r-empty">点击「试算」查看数据预览</div></td></tr>
                <tr v-for="r in previewRows" :key="r.date">
                  <td>{{ r.date }}</td>
                  <td class="v">{{ r.value }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <div v-if="note" class="cd-r-note">{{ note }}</div>
      </section>
    </div>
    <template #footer>
      <span class="foot-left">试算通过后可保存指标；代码需以 format_data 格式化输出</span>
      <button type="button" class="btn tint" @click="saveDraft">保存草稿</button>
      <button type="button" class="btn" @click="close">取消</button>
      <button type="button" class="btn primary" @click="save">保存</button>
    </template>
  </AppModal>
</template>
