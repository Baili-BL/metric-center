<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { Message } from '@arco-design/web-vue'
import { CALC_TYPES, GROUP_ORDER, useIndicatorStore } from '../../stores/indicators'
import Icon from '../../components/Icon.vue'
import DirPathPicker from '../../components/DirPathPicker.vue'
import IndPicker from './IndPicker.vue'
import '../../styles/calc-dialog.css'

const EXTRA_INDS = [
  '盘螺基差:10太原宏达', '螺纹钢:HRB400E:Φ18:市场价:上海', '螺纹钢:HRB400E:Φ20:市场价:上海',
  '商品猪:出栏均价:中国(日)', '焦炭:一级冶金焦:日照港平仓价', 'SMM 1#电解铜现货价',
  'CPI:当月同比', 'PPI:当月同比', 'M2:货币供应量:同比',
]
const COMMON_UNITS = ['无', '%', '点', '万吨', '亿元', '千元', '元', '元/吨', '元/湿吨', '千克', '吨', '短吨', '美元/吨', '美元/桶', '美分/加仑', '万平方千米', '手']
const NULL_FILL = ['查找前后35天最近值', '不计算', '前值填充', '后值填充', '等于0']
const FREQS = ['日频', '周频', '月频', '季频', '年频']
const QTIPS = {
  null: '<b>1、查找前后35天最近值：</b>在参与计算的日期序列上某指标无值时，该指标往前/往后找距离最近的值作为当天的值进行计算，遍历允许跨年，往前最多35天，往后最多35天<br><b>2、不计算：</b>只要有一个指标在某个日期没有值（即空值），则计算指标在该日期没有值<br><b>3、前值填充：</b>空值优先以最近的前值填充，没有前值时，用后值填充<br><b>4、后值填充：</b>空值优先以最近的后值填充，没有前值时，用后值填充<br><b>5、等于0：</b>空值以 0 值参与计算<div class="q-note">注意：此处缺失值的处理，作用于数据全部时间段</div>',
  yoy: '<b>同比公式：</b>今年同期 / 去年同期 − 1',
  yoydiff: '<b>同差公式：</b>今年同期 − 去年同期',
  cum: '<b>累计值计算方法：</b>日度转周度按上周六至本周五加总；日度转月度按当月加总；周度转更低频先插值为日度再加总后除以 7。',
  expr: '主公式作用于所有分段日期中的最大日期（含）之后。支持 +、−、×、÷ 与括号，输入 @ 可插入上方参数。',
}

const props = defineProps({
  visible: { type: Boolean, default: false },
  viewOnly: { type: Boolean, default: false },
  seedTitle: { type: String, default: '' },
})
const emit = defineEmits(['update:visible', 'saved'])

const store = useIndicatorStore()
const typeId = ref(1)
const typeKw = ref('')
const form = reactive({ title: '', unit: '', dir: '', freq: '月频', desc: '' })
const err = reactive({ name: false, dir: false, expr: false })
const unitOpen = ref(false)
const arcoPopup = { popupStyle: { zIndex: 5200 }, updateAtScroll: true }
const seriesOpen = ref(false)
const nullOpen = ref(false)
const tip = reactive({ show: false, html: '', x: 0, y: 0 })
const mention = reactive({ show: false, items: [], x: 0, y: 0, el: null })
const exprMain = ref(null)
const p = reactive(emptyParams(1))

const currentOp = computed(() => CALC_TYPES.find((t) => t.id === typeId.value) || CALC_TYPES[0])
const groupedOps = computed(() => {
  const q = typeKw.value.trim()
  return GROUP_ORDER.map((g) => ({
    group: g,
    items: CALC_TYPES.filter((t) => t.group === g && (!q || t.name.includes(q))),
  })).filter((g) => g.items.length)
})
const names = computed(() => {
  const seen = new Set()
  const list = []
  store.cards.forEach((c) => { if (c.title && !seen.has(c.title)) { seen.add(c.title); list.push(c.title) } })
  EXTRA_INDS.forEach((n) => { if (!seen.has(n)) { seen.add(n); list.push(n) } })
  return list
})
const unitItems = computed(() => {
  const k = form.unit.trim().toLowerCase()
  const items = COMMON_UNITS.filter((u) => !k || u.toLowerCase().includes(k))
  return items.length ? items : COMMON_UNITS
})
const pickedNames = computed(() => {
  const out = []
  if (typeId.value === 1) p.params.forEach((x) => { if (x.name) out.push(x.name) })
  else if (typeId.value === 16) p.kids.forEach((x) => { if (x.name) out.push(x.name) })
  else if (p.x) out.push(p.x)
  if (p.y) out.push(p.y)
  if (p.before) out.push(p.before)
  if (p.after) out.push(p.after)
  return out
})
const preview = computed(() => buildPreview())
const nameSug = computed(() => buildSuggestedName())
const afterLabel = computed(() => {
  const dates = p.segs.map((s) => s.date).filter(Boolean).sort()
  return dates.length ? `${dates[dates.length - 1]}(含)之后` : ''
})

function emptyParams(id) {
  return {
    params: [{ letter: 'A', name: '' }],
    segs: [{ expr: '', date: '' }],
    expr: '',
    seriesMode: 'union',
    seriesParam: '',
    nullFill: '查找前后35天最近值',
    x: '', y: '', n: id === 5 ? 5 : id === 12 ? 12 : 1,
    fill: '向前填充',
    mode: id === 2 ? '转月度' : id === 15 ? '平均值' : id === 17 ? '默认' : '领先',
    k: id === 10 ? 30 : 1,
    cal: '公历',
    t13mode: '领先天数',
    lead: 10,
    start: '', end: '',
    t9tab: 'direct',
    t9date: '',
    before: '', after: '',
    t9diff: 0,
    kids: [{ letter: 'A', name: '' }],
    t16dates: '全部日期并集',
    t16picked: [],
    alpha: 0.3,
  }
}
function rangeOf(name) {
  const c = store.cards.find((x) => x.title === name)
  const start = c?.start || '2015-01-05'
  const end = c?.end || c?.latestDate || '2026-07-29'
  return `${start}至${end}`
}
function resetParams(keepBasic) {
  Object.assign(p, emptyParams(typeId.value))
  if (!keepBasic) {
    form.title = ''
    form.unit = ''
    form.desc = ''
    err.name = false
    err.dir = false
  }
}
function selectType(id) {
  const t = CALC_TYPES.find((x) => x.id === id)
  if (!t || (!t.ready && !props.viewOnly)) return
  typeId.value = id
  Object.assign(p, emptyParams(id))
}
function close() {
  emit('update:visible', false)
}
function onBackdrop(e) {
  if (e.target === e.currentTarget) close()
}
function addParam() {
  if (p.params.length >= 10) return Message.warning('最多支持 10 个参数')
  p.params.push({ letter: String.fromCharCode(65 + p.params.length), name: '' })
}
function delParam(i) {
  if (p.params.length <= 1) return
  p.params.splice(i, 1)
  p.params.forEach((x, idx) => { x.letter = String.fromCharCode(65 + idx) })
}
function addSeg() {
  if (p.segs.length >= 5) return Message.warning('最多支持 5 个分段')
  p.segs.push({ expr: '', date: '' })
}
function delSeg(i) {
  p.segs.splice(i, 1)
}
function segBefore(i) {
  const dates = p.segs.map((s) => s.date).filter(Boolean).sort()
  const v = p.segs[i].date
  if (!v) return ''
  const idx = dates.indexOf(v)
  return idx <= 0 ? `${v}之前` : `${dates[idx - 1]}(含)——${v}`
}
function addKid() {
  if (p.kids.length >= 20) return Message.warning('最多支持 20 个子指标')
  p.kids.push({ letter: String.fromCharCode(65 + p.kids.length), name: '' })
}
function delKid(i) {
  if (p.kids.length <= 1) return
  p.kids.splice(i, 1)
  p.kids.forEach((x, idx) => { x.letter = String.fromCharCode(65 + idx) })
}
function onPicked(name) {
  const c = store.cards.find((x) => x.title === name)
  if (c?.freq && FREQS.includes(c.freq)) form.freq = c.freq
}
function useSug() {
  form.title = nameSug.value
  err.name = false
}
function genDesc() {
  const x = pickedNames.value[0] || '基础指标'
  form.desc = `对「${x}」执行${currentOp.value.name}计算。${currentOp.value.desc}。计算口径详见公式预览。`
}
function showTip(e, key) {
  const r = e.target.getBoundingClientRect()
  tip.html = QTIPS[key] || ''
  tip.x = Math.min(r.left, window.innerWidth - 420)
  tip.y = r.bottom + 8
  tip.show = true
}
function exprText(el) {
  if (!el) return ''
  let out = ''
  el.childNodes.forEach((n) => {
    if (n.nodeType === 3) out += n.textContent
    else if (n.classList?.contains('p-chip')) out += n.dataset.letter
    else out += n.textContent || ''
  })
  return out
}
function isValidCalcExpr(raw) {
  const s = String(raw || '').replace(/[×✕]/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/\s+/g, '')
  if (!s) return false
  let depth = 0
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '(') depth++
    else if (s[i] === ')') { depth--; if (depth < 0) return false }
  }
  if (depth !== 0) return false
  const leftover = s.replace(/\b(MAX|MIN|LN|LOG|ABS|EXP|POW|ROUND)\b/gi, '').replace(/[A-J]/gi, '').replace(/\d+(\.\d+)?/g, '').replace(/[+\-*/(),.]/g, '')
  if (leftover) return false
  if (!/[A-J0-9]/i.test(s)) return false
  const compact = s.replace(/([*/(]|^)[+\-]/g, '$1')
  if (/[+\-*/]{2,}/.test(compact)) return false
  return true
}
function shortIndName(name) {
  if (!name) return '原指标'
  const head = String(name).split(':')[0].trim()
  return head.length > 18 ? head.slice(0, 18) : (head || '原指标')
}
function buildSuggestedName() {
  const picks = pickedNames.value
  const base = picks.length ? shortIndName(picks[0]) : '原指标'
  const multi = picks.length > 1 ? picks.slice(0, 3).map(shortIndName).join('+') + (picks.length > 3 ? '等' : '') : base
  const id = typeId.value
  if (id === 1) return (picks.length > 1 ? multi : base) + (p.expr ? `_${p.expr.replace(/\s+/g, '')}` : '_指标运算')
  if (id === 2) return `${base}_${p.mode || '转月度'}`
  if (id === 3) return `${base}_同比`
  if (id === 4) return `${base}_同差值`
  if (id === 5) return `${base}_MA${p.n || 'N'}`
  if (id === 6) return `${base}${Number(p.n) === 1 ? '_环比' : `_${p.n}期环比`}`
  if (id === 7) return `${base}${Number(p.n) === 1 ? '_环差' : `_${p.n}期环差`}`
  if (id === 8) return `${base}_开频_${p.fill || '向前填充'}`
  if (id === 9) return `${picks.length ? multi : base}${p.t9tab === 'direct' ? '_拼接' : '_累计拼接'}`
  if (id === 10) return `${base}_${p.mode || '领先'}${p.k || 'k'}天`
  if (id === 11) return `${base}_${p.mode || '领先'}${p.k || 'k'}期`
  if (id === 12) return `${base}_季节_${p.cal || '公历'}_N${p.n || 12}`
  if (id === 13) return `${picks.length ? multi : base}_拟合`
  if (id === 14) return `${base}_年化`
  if (id === 15) return `${base}_降频_${p.mode || '平均值'}`
  if (id === 16) return `${picks.length ? multi : base}_扩散指数`
  if (id === 17) return `${base}_累计${form.freq ? `_${form.freq}` : ''}`
  if (id === 18) return `${base}_指数修匀_α${p.alpha || '0.3'}`
  if (id === 19) return `${base}_日均值`
  return `${base}_${currentOp.value.name}`
}
function q(name) { return name ? `「${name}」` : 'X' }
function buildPreview() {
  const x = q(p.x || pickedNames.value[0] || '')
  const id = typeId.value
  if (id === 1) {
    const main = (p.expr || 'A + B') + (afterLabel.value ? `　[${afterLabel.value}]` : '')
    const lines = [`y = ${main}`]
    p.segs.forEach((s, i) => {
      const lab = segBefore(i)
      lines.push(`y = ${s.expr || 'A + B'}${lab ? `　[${lab}]` : ''}`)
    })
    return `${lines.join('\n')}\n（序列：${p.seriesMode === 'union' ? '所有指标序列并集' : '指定序列'}，空值处理：${p.nullFill}）`
  }
  if (id === 2) return `y(t) = ${x}(t) − ${x}(t−1)　（累计差分，${p.mode || '转月度'}）`
  if (id === 3) return `y(t) = ${x}(今年同期) ÷ ${x}(去年同期) − 1`
  if (id === 4) return `y(t) = ${x}(今年同期) − ${x}(去年同期)`
  if (id === 5) return `y(t) = MA( ${x}(t), N = ${p.n || '—'} )`
  if (id === 6) return `y(t) = ${x}(t) ÷ ${x}(t − ${p.n || 'N'})`
  if (id === 7) return `y(t) = ${x}(t) − ${x}(t − ${p.n || 'N'})`
  if (id === 8) return `y = 升频(${x})，空值处理：${p.fill || '向前填充'}`
  if (id === 9) {
    return p.t9tab === 'direct'
      ? `y = t < ${p.t9date || '拼接日'} ? 前期指标 : 后期指标`
      : `y = 累计拼接(拼接指标)，可比差值 = ${p.t9diff || 0}`
  }
  if (id === 10) return `y(t) = ${x}(t ${p.mode === '滞后' ? '+' : '−'} ${p.k || 'k'} 天)`
  if (id === 11) return `y(t) = ${x}(t ${p.mode === '滞后' ? '+' : '−'} ${p.k || 'k'} 期)`
  if (id === 12) return `y = 季节对齐(${x}, N = ${p.n || 12}, ${p.cal || '公历'})`
  if (id === 13) return `y = 0x + 0 r=0.000000　（残差，${p.t13mode === '领先天数' ? `领先 ${p.lead || 0} 天` : '标准指标'}，拟合区间 [${p.start || '开始'} ~ ${p.end || '结束'}]）`
  if (id === 14) return `y(t) = ${x}(t) 年化折算`
  if (id === 15) return `y = 降频(${x})，取值方式：${p.mode || '平均值'}`
  if (id === 16) {
    let mode = p.t16dates
    if (mode === '部分日期并集') mode += p.t16picked.length ? `（${p.t16picked.join('、')}）` : '（未选）'
    return `y = mean(x₁…x${p.kids.length > 1 ? 'n' : '₁'}) 相对「母指标」　（${mode}）`
  }
  if (id === 17) return `y = 累计(${x} → 目标频率)，最新值处理：${p.mode || '默认'}`
  if (id === 18) return `y(t) = ${p.alpha || 'α'}·${x}(t) + (1 − ${p.alpha || 'α'})·y(t−1)`
  if (id === 19) return `y(t) = ${x}(t) ÷ 当期天数`
  return `y = ${currentOp.value.name}(${x})`
}
function onExprInput(e, target) {
  const text = exprText(e.target)
  if (target === 'main') p.expr = text
  checkMention(e.target)
}
function checkMention(el) {
  const sel = window.getSelection()
  if (!sel?.rangeCount) { mention.show = false; return }
  const range = sel.getRangeAt(0)
  const node = range.startContainer
  if (node.nodeType !== 3 || !el.contains(node)) { mention.show = false; return }
  const before = node.textContent.slice(0, range.startOffset)
  const at = before.lastIndexOf('@')
  if (at < 0) { mention.show = false; return }
  const kw = before.slice(at + 1)
  if (kw.length > 12 || /[@\s+\-*/(),]/.test(kw)) { mention.show = false; return }
  const items = p.params.map((x) => ({ letter: x.letter, name: x.name || `指标${x.letter}` }))
    .filter((it) => !kw || it.letter.toLowerCase().includes(kw.toLowerCase()) || it.name.toLowerCase().includes(kw.toLowerCase()))
  if (!items.length) { mention.show = false; return }
  const r = el.getBoundingClientRect()
  mention.show = true
  mention.items = items
  mention.x = r.left
  mention.y = r.bottom + 4
  mention.el = el
  mention.node = node
  mention.off = at
}
function applyMention(letter, name) {
  const el = mention.el
  const node = mention.node
  if (!el || !node) return
  const sel = window.getSelection()
  const end = sel?.rangeCount && sel.getRangeAt(0).startContainer === node ? sel.getRangeAt(0).startOffset : node.textContent.length
  const beforeTxt = node.textContent.slice(0, mention.off)
  const afterTxt = node.textContent.slice(end)
  const chip = document.createElement('span')
  chip.className = 'p-chip'
  chip.contentEditable = 'false'
  chip.dataset.letter = letter
  chip.innerHTML = `<span class="p-letter">${letter}</span>${name ? `<span class="p-name">${name}</span>` : ''}`
  const parent = node.parentNode
  const beforeNode = document.createTextNode(beforeTxt)
  const afterNode = document.createTextNode(afterTxt ? `\u00a0${afterTxt}` : '\u00a0')
  parent.insertBefore(beforeNode, node)
  parent.insertBefore(chip, node)
  parent.insertBefore(afterNode, node)
  parent.removeChild(node)
  mention.show = false
  p.expr = exprText(el)
  el.focus()
}
function fillView(title) {
  const card = store.cards.find((c) => c.title === title)
  const type = CALC_TYPES.find((t) => t.name === card?.calcType) || CALC_TYPES[0]
  typeId.value = type.id
  Object.assign(p, emptyParams(type.id))
  form.title = title
  form.unit = card?.unit || ''
  form.freq = card?.freq || '月频'
  form.dir = card?.dir || ''
  const deps = card?.deps?.length ? card.deps : names.value.slice(0, 2)
  if (type.id === 1) {
    p.params = deps.slice(0, 5).map((n, i) => ({ letter: String.fromCharCode(65 + i), name: n }))
    if (!p.params.length) p.params = [{ letter: 'A', name: '' }]
    p.expr = card?.formula || (deps.length > 1 ? 'A + B' : 'A')
    nextTick(() => { if (exprMain.value) exprMain.value.textContent = p.expr })
  } else {
    p.x = deps[0] || ''
    p.y = deps[1] || ''
  }
  form.desc = `对「${deps[0] || '基础指标'}」执行${type.name}计算。${type.desc}。计算口径详见公式预览。`
}
function openFresh() {
  typeKw.value = ''
  typeId.value = 1
  resetParams(false)
  const prefer = store.currentDir || '中国宏观/价格指数'
  form.dir = prefer
  form.freq = '月频'
}
function confirm() {
  if (props.viewOnly) { close(); return }
  if (!currentOp.value.ready) return Message.warning('该计算方式正在开发中')
  if (!form.title.trim()) { err.name = true; return Message.warning('请填写指标名') }
  if (!form.dir) { err.dir = true; return Message.warning('请选择指标目录') }
  if (typeId.value === 18 && !(Number(p.alpha) >= 0 && Number(p.alpha) <= 1)) return Message.warning('请输入0-1的数值')
  if (typeId.value === 1) {
    const text = p.expr.trim()
    if (!text || !isValidCalcExpr(text)) { err.expr = true; return Message.warning('公式错误，请重新填写') }
  }
  const card = store.addCalc({
    title: form.title.trim(),
    calcType: currentOp.value.name,
    dir: form.dir,
    unit: form.unit,
    freq: form.freq,
    formula: preview.value,
    deps: pickedNames.value,
  })
  Message.success(`已保存计算指标：${form.title.trim()} → ${form.dir}`)
  emit('saved', card)
  close()
}
function onDoc(e) {
  if (!e.target.closest?.('.unit-combo')) unitOpen.value = false
  if (!e.target.closest?.('.sel')) { seriesOpen.value = false; nullOpen.value = false }
  if (!e.target.closest?.('.mention-pop') && !e.target.closest?.('.expr')) mention.show = false
}

watch(() => props.visible, (v) => {
  if (!v) return
  if (props.viewOnly && props.seedTitle) fillView(props.seedTitle)
  else openFresh()
})

onMounted(() => document.addEventListener('click', onDoc))
onBeforeUnmount(() => document.removeEventListener('click', onDoc))
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="calc-overlay" :class="{ 'is-view': viewOnly }" @click="onBackdrop">
      <div class="dialog" role="dialog" aria-modal="true" @click.stop>
        <header class="dlg-header">
          <span class="mh-title">
            <span class="mh-ico"><Icon name="g-1fef0bd3" :size="16" /></span>
            <span>{{ viewOnly ? '查看公式' : '添加计算指标' }}</span>
          </span>
          <span class="sub">{{ currentOp.name }} · {{ currentOp.desc }}</span>
          <button class="close" type="button" title="关闭" @click="close">✕</button>
        </header>
        <div class="dlg-body">
          <aside class="aside">
            <div class="search"><input v-model="typeKw" placeholder="搜索计算方式" autocomplete="off"></div>
            <nav>
              <div v-if="!groupedOps.length" class="nav-empty">未找到匹配的计算方式</div>
              <div v-for="g in groupedOps" :key="g.group" class="nav-group">
                <div class="g-title">{{ g.group }}</div>
                <button
                  v-for="op in g.items"
                  :key="op.id"
                  type="button"
                  class="nav-item"
                  :class="{ active: typeId === op.id, dev: !op.ready }"
                  :disabled="!op.ready && !viewOnly"
                  :title="op.ready ? op.desc : '正在开发中'"
                  @click="selectType(op.id)"
                >
                  <span>{{ op.name }}</span>
                  <span v-if="!op.ready" class="dev-tag">开发中</span>
                </button>
              </div>
            </nav>
          </aside>
          <main class="main">
            <section class="card">
              <h3>参数配置 <span class="h3-sub">（{{ currentOp.name }}）</span></h3>

              <template v-if="typeId === 1">
                <div class="block">
                  <div class="block-title">添加参数 <span class="tip">为表达式中的每个变量精准匹配一个指标</span></div>
                  <div v-for="(row, i) in p.params" :key="row.letter" class="param-row">
                    <span class="param-tag">{{ row.letter }}</span>
                    <IndPicker v-model="row.name" :names="names" :range-of="rangeOf" :placeholder="`精准匹配指标（参数 ${row.letter}）`" :disabled="viewOnly" @picked="onPicked" />
                    <button type="button" class="icon-btn" title="删除参数" @click="delParam(i)">✕</button>
                  </div>
                  <button type="button" class="link-btn" @click="addParam">＋ 添加更多参数</button>
                </div>
                <div class="divider"></div>
                <div class="form-row">
                  <span class="inline-label req">生成指标时间序列</span>
                  <div class="sel" :class="{ open: seriesOpen }">
                    <div class="sel-current" @click.stop="seriesOpen = !seriesOpen">
                      <span>{{ p.seriesMode === 'union' ? '所有指标序列并集' : (p.params.find(x => x.letter === p.seriesParam)?.name || '指定指标时间序列') }}</span>
                      <span class="chev"><Icon name="chevron-down" :size="11" /></span>
                    </div>
                    <div class="sel-panel">
                      <div class="sel-item has-sub">指定指标时间序列<span class="arr">›</span>
                        <div class="sel-sub">
                          <div v-for="row in p.params" :key="row.letter" class="sel-item" :class="{ cur: p.seriesMode === 'specific' && p.seriesParam === row.letter }" @click="p.seriesMode = 'specific'; p.seriesParam = row.letter; seriesOpen = false">
                            {{ row.name || ('指标' + row.letter) }}
                          </div>
                        </div>
                      </div>
                      <div class="sel-item" @click="p.seriesMode = 'union'; seriesOpen = false">所有指标时间序列并集</div>
                    </div>
                  </div>
                </div>
                <div class="form-row">
                  <span class="inline-label">空值处理 <span class="q-ic" @mouseenter="showTip($event, 'null')" @mouseleave="tip.show = false">?</span></span>
                  <div class="sel null-sel" :class="{ open: nullOpen }">
                    <div class="sel-current" @click.stop="nullOpen = !nullOpen">
                      <span>{{ p.nullFill }}</span>
                      <span class="chev"><Icon name="chevron-down" :size="11" /></span>
                    </div>
                    <div class="sel-panel">
                      <div v-for="o in NULL_FILL" :key="o" class="sel-item" :class="{ cur: p.nullFill === o }" @click="p.nullFill = o; nullOpen = false">{{ o }}</div>
                    </div>
                  </div>
                </div>
                <div class="divider"></div>
                <div class="form-row expr-main-row">
                  <span class="inline-label">计算公式 <span class="q-ic" @mouseenter="showTip($event, 'expr')" @mouseleave="tip.show = false">?</span></span>
                  <div class="expr-main-col">
                    <div class="expr-main-line">
                      <div
                        ref="exprMain"
                        class="expr expr-main"
                        :class="{ 'is-err': err.expr }"
                        contenteditable
                        spellcheck="false"
                        data-ph="请输入公式"
                        @input="onExprInput($event, 'main')"
                      ></div>
                      <span v-if="afterLabel" class="seg-after">{{ afterLabel }}</span>
                    </div>
                    <div class="expr-hint">公式示例：<code>A*0.5+B*C*1.2+120-MAX(A,B,C)</code><br>函数支持：MAX()、MIN()、ln(A)、log(a,A)、abs()、exp()、pow()、round()</div>
                    <div v-for="(seg, i) in p.segs" :key="i" class="seg-row">
                      <div class="seg-expr-wrap">
                        <input class="expr" v-model="seg.expr" placeholder="请输入公式">
                      </div>
                      <div class="seg-date-wrap" :class="{ 'has-val': !!seg.date }">
                        <span class="seg-date-cal"><Icon name="calendar" :size="14" /></span>
                        <input type="date" class="seg-date" v-model="seg.date">
                      </div>
                      <button type="button" class="seg-del" @click="delSeg(i)">✕</button>
                      <span v-if="seg.date" class="seg-before">{{ segBefore(i) }}</span>
                    </div>
                    <button type="button" class="add-seg-btn" @click="addSeg">＋ 新增分段</button>
                  </div>
                </div>
              </template>

              <template v-else-if="typeId === 9">
                <div class="seg-control">
                  <button type="button" :class="{ active: p.t9tab === 'direct' }" @click="p.t9tab = 'direct'">直接拼接</button>
                  <button type="button" :class="{ active: p.t9tab === 'cum' }" @click="p.t9tab = 'cum'">累计值拼接</button>
                </div>
                <template v-if="p.t9tab === 'direct'">
                  <div class="form-row"><span class="inline-label req">拼接日期</span><input type="date" class="date-input" v-model="p.t9date"></div>
                  <div class="form-row"><span class="inline-label req">拼接日期之前</span><IndPicker v-model="p.before" :names="names" :range-of="rangeOf" placeholder="选择拼接日期之前使用的指标" @picked="onPicked" /></div>
                  <div class="form-row"><span class="inline-label req">拼接日期之后</span><IndPicker v-model="p.after" :names="names" :range-of="rangeOf" placeholder="选择拼接日期之后使用的指标" @picked="onPicked" /></div>
                </template>
                <template v-else>
                  <div class="form-row"><span class="inline-label req">拼接指标</span><IndPicker v-model="p.x" :names="names" :range-of="rangeOf" @picked="onPicked" /></div>
                  <div class="form-row"><span class="inline-label">可比差值</span><input type="number" class="num-input" v-model="p.t9diff" placeholder="如 0"></div>
                </template>
              </template>

              <template v-else-if="typeId === 16">
                <div class="block">
                  <div class="block-title">添加指标 <span class="tip">参与合成的子指标，可多个</span></div>
                  <div v-for="(row, i) in p.kids" :key="row.letter" class="param-row">
                    <span class="param-tag">{{ row.letter }}</span>
                    <IndPicker v-model="row.name" :names="names" :range-of="rangeOf" placeholder="选择子指标" @picked="onPicked" />
                    <button type="button" class="icon-btn" @click="delKid(i)">✕</button>
                  </div>
                  <button type="button" class="link-btn" @click="addKid">＋ 添加指标</button>
                </div>
                <div class="divider"></div>
                <div class="form-row">
                  <span class="inline-label req">扩散指标日期</span>
                  <div class="pill-group">
                    <label class="pill"><input type="radio" value="全部日期并集" v-model="p.t16dates"><span>全部日期并集</span></label>
                    <label class="pill"><input type="radio" value="部分日期并集" v-model="p.t16dates"><span>部分日期并集</span></label>
                  </div>
                  <div v-if="p.t16dates === '部分日期并集'" class="t16-checks">
                    <label v-for="row in p.kids" :key="row.letter" class="t16-ck"><input type="checkbox" :value="row.letter" v-model="p.t16picked"><span>{{ row.letter }}</span></label>
                  </div>
                </div>
                <div class="form-row"><span class="inline-label req">选择母指标</span><IndPicker v-model="p.y" :names="names" :range-of="rangeOf" placeholder="选择作为基准的母指标" @picked="onPicked" /></div>
              </template>

              <template v-else-if="typeId === 13">
                <div class="form-row"><span class="inline-label req">自变量 (x)</span><IndPicker v-model="p.x" :names="names" :range-of="rangeOf" placeholder="选择自变量指标" @picked="onPicked" /></div>
                <div class="form-row">
                  <span class="inline-label"></span>
                  <label class="t13-radio"><input type="radio" value="标准指标" v-model="p.t13mode">标准指标</label>
                  <label class="t13-radio"><input type="radio" value="领先天数" v-model="p.t13mode">领先天数</label>
                  <input type="number" class="num-input" style="width:72px" v-model="p.lead" :disabled="p.t13mode !== '领先天数'" min="0">
                  <span class="to">天</span>
                </div>
                <div class="form-row"><span class="inline-label req">因变量 (y)</span><IndPicker v-model="p.y" :names="names" :range-of="rangeOf" placeholder="选择因变量指标" @picked="onPicked" /></div>
                <div class="form-row">
                  <span class="inline-label req">拟合时间段</span>
                  <input type="date" class="date-input" v-model="p.start">
                  <span class="to">至</span>
                  <input type="date" class="date-input" v-model="p.end">
                  <span class="t13-eq">y = 0x + 0 r=0.000000</span>
                </div>
              </template>

              <template v-else>
                <div class="form-row">
                  <span class="inline-label req">{{ typeId === 2 ? '选择累计值指标' : '选择指标' }}</span>
                  <IndPicker v-model="p.x" :names="names" :range-of="rangeOf" @picked="onPicked" />
                </div>
                <div v-if="typeId === 5" class="form-row"><span class="inline-label req">N 值</span><input type="number" class="num-input" v-model="p.n" min="1"><span class="to">移动平均窗口（期）</span></div>
                <div v-else-if="typeId === 6 || typeId === 7" class="form-row"><span class="inline-label req">N 等于</span><input type="number" class="num-input" v-model="p.n" min="1"></div>
                <div v-else-if="typeId === 8" class="form-row">
                  <span class="inline-label req">空值处理</span>
                  <div class="pill-group">
                    <label class="pill"><input type="radio" value="向前填充" v-model="p.fill"><span>向前填充</span></label>
                    <label class="pill"><input type="radio" value="向后填充" v-model="p.fill"><span>向后填充</span></label>
                  </div>
                </div>
                <div v-else-if="typeId === 15" class="form-row">
                  <span class="inline-label req">数据取值</span>
                  <div class="pill-group">
                    <label class="pill"><input type="radio" value="平均值" v-model="p.mode"><span>平均值</span></label>
                    <label class="pill"><input type="radio" value="年末值" v-model="p.mode"><span>年末值</span></label>
                  </div>
                </div>
                <div v-else-if="typeId === 17">
                  <div class="form-row">
                    <span class="inline-label req">最新值处理</span>
                    <div class="pill-group">
                      <label class="pill"><input type="radio" value="默认" v-model="p.mode"><span>默认</span></label>
                      <label class="pill"><input type="radio" value="均值" v-model="p.mode"><span>均值</span></label>
                    </div>
                  </div>
                  <div class="form-row yoy-row">
                    <span class="inline-label">计算方法 <span class="q-ic" @mouseenter="showTip($event, 'cum')" @mouseleave="tip.show = false">?</span></span>
                    <div class="expr-hint" style="margin:6px 0 0">日度转周度按上周六至本周五加总（日期取周五）；日度转月度按当月加总。目标频率沿用基本信息中的数据频率。</div>
                  </div>
                </div>
                <div v-else-if="typeId === 18" class="form-row">
                  <span class="inline-label req">alpha 值</span>
                  <input type="number" class="num-input" v-model="p.alpha" min="0" max="1" step="0.01">
                </div>
                <div v-else-if="typeId === 10 || typeId === 11">
                  <div class="form-row">
                    <span class="inline-label req">移动方式</span>
                    <div class="pill-group">
                      <label class="pill"><input type="radio" value="领先" v-model="p.mode"><span>领先</span></label>
                      <label class="pill"><input type="radio" value="滞后" v-model="p.mode"><span>滞后</span></label>
                    </div>
                  </div>
                  <div class="form-row">
                    <span class="inline-label req">{{ typeId === 10 ? '移动时间' : '移动期数' }}</span>
                    <input type="number" class="num-input" v-model="p.k" min="1">
                    <span class="to">{{ typeId === 10 ? '天' : '期' }}</span>
                  </div>
                </div>
                <div v-else-if="typeId === 12">
                  <div class="form-row"><span class="inline-label req">N</span><input type="number" class="num-input" v-model="p.n" min="1"></div>
                  <div class="form-row">
                    <span class="inline-label req">日历选择</span>
                    <div class="pill-group">
                      <label class="pill"><input type="radio" value="公历" v-model="p.cal"><span>公历</span></label>
                      <label class="pill"><input type="radio" value="春节对齐" v-model="p.cal"><span>春节对齐</span></label>
                    </div>
                  </div>
                </div>
                <div v-else-if="typeId === 2" class="form-row">
                  <span class="inline-label req">转换方式</span>
                  <div class="pill-group">
                    <label class="pill"><input type="radio" value="转月度" v-model="p.mode"><span>转月度</span></label>
                  </div>
                </div>
                <div v-else-if="typeId === 3" class="form-row yoy-row">
                  <span class="inline-label">计算公式 <span class="q-ic" @mouseenter="showTip($event, 'yoy')" @mouseleave="tip.show = false">?</span></span>
                  <div class="expr-main-col">
                    <div class="yoy-fml">今年同期 / 去年同期 − 1</div>
                    <div class="expr-hint">匹配去年同期时，取过去一年有值日期中与当前日期相等或最接近的一天。</div>
                  </div>
                </div>
                <div v-else-if="typeId === 4" class="form-row yoy-row">
                  <span class="inline-label">计算公式 <span class="q-ic" @mouseenter="showTip($event, 'yoydiff')" @mouseleave="tip.show = false">?</span></span>
                  <div class="expr-main-col">
                    <div class="yoy-fml">今年同期 − 去年同期</div>
                    <div class="expr-hint">去年同期匹配规则与同比相同。</div>
                  </div>
                </div>
                <div v-else-if="typeId === 14 || typeId === 19" class="form-row">
                  <span class="to" style="font-size:12px">该计算方式仅需一个基础指标，其余参数沿用基本信息中的设置。</span>
                </div>
              </template>
            </section>

            <section class="card">
              <h3>基本信息</h3>
              <div class="grid2">
                <div class="field" :class="{ error: err.name }">
                  <label class="req">指标名</label>
                  <input v-model="form.title" placeholder="请输入计算指标名称" autocomplete="off" @input="err.name = false">
                  <div class="hint">建议命名：<span>{{ nameSug }}</span><button type="button" @click="useSug">使用</button></div>
                </div>
                <div class="field">
                  <label class="req">指标单位</label>
                  <div class="unit-combo" :class="{ open: unitOpen }">
                    <input v-model="form.unit" placeholder="选择或输入单位" autocomplete="off" @focus="unitOpen = true">
                    <button type="button" class="unit-caret" @click.stop="unitOpen = !unitOpen"><Icon name="chevron-down" :size="12" /></button>
                    <div class="unit-panel">
                      <div v-for="u in unitItems" :key="u" class="unit-item" :class="{ cur: form.unit === u }" @mousedown.prevent="form.unit = u; unitOpen = false">{{ u }}</div>
                    </div>
                  </div>
                </div>
                <div class="field" :class="{ error: err.dir }">
                  <label class="req">指标目录</label>
                  <DirPathPicker v-model="form.dir" :tree="store.dirs" placeholder="请选择指标目录" @update:model-value="err.dir = false" />
                </div>
                <div class="field">
                  <label class="req">数据频率</label>
                  <a-select v-model="form.freq" class="app-field-select" popup-container="body" :trigger-props="arcoPopup">
                    <a-option v-for="f in FREQS" :key="f" :value="f">{{ f }}</a-option>
                  </a-select>
                </div>
              </div>
              <div class="field full">
                <label>公式说明</label>
                <textarea v-model="form.desc" placeholder="说明该指标的计算口径与用途（可自动生成）"></textarea>
                <div class="hint"><button type="button" @click="genDesc">按当前计算方式自动生成</button></div>
              </div>
            </section>
            <div class="preview-bar">
              <span class="p-label">公式预览</span>
              <code>{{ preview }}</code>
            </div>
          </main>
        </div>
        <footer class="dlg-footer">
          <span class="foot-tip">{{ viewOnly ? '当前为只读回显，计算方式与公式参数不可编辑' : '带 * 为必填项；切换计算方式不会清空基本信息' }}</span>
          <button type="button" class="btn" @click="close">{{ viewOnly ? '关闭' : '取消' }}</button>
          <button v-if="!viewOnly" type="button" class="btn primary ok-btn" @click="confirm">确定保存</button>
        </footer>
      </div>
      <div v-if="tip.show" class="q-pop" :style="{ left: tip.x + 'px', top: tip.y + 'px' }" v-html="tip.html"></div>
      <div v-if="mention.show" class="mention-pop" :style="{ left: mention.x + 'px', top: mention.y + 'px' }">
        <div v-for="(it, i) in mention.items" :key="it.letter" class="mention-item" :class="{ cur: i === 0 }" @mousedown.prevent="applyMention(it.letter, it.name)">
          <span class="m-letter">{{ it.letter }}</span>
          <span class="m-name">{{ it.name }}</span>
        </div>
      </div>
    </div>
  </Teleport>
</template>
