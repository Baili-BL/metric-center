<script setup>
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import AppModal from './AppModal.vue'

const props = defineProps({
  visible: Boolean,
  title: { type: String, default: '备注内容' },
  html: { type: String, default: '' },
  placeholder: { type: String, default: '请输入备注' },
})
const emit = defineEmits(['update:visible', 'ok'])

const editorEl = ref(null)
const blockMode = ref('p')
const fontSize = ref('12')
const empty = ref(true)
let savedRange = null
let focusTimer = 0

const BLOCK_OPTIONS = [
  { value: 'p', label: '正文' },
  { value: 'h3', label: '标题1' },
  { value: 'h4', label: '标题2' },
]
const SIZE_OPTIONS = ['12', '13', '14', '16', '18', '20', '24']
const LIST_MAIN = [
  { id: 'decimal', title: '1. 2. 3.', samples: ['1.', '2.', '3.'] },
  { id: 'circled', title: '① ② ③', samples: ['①', '②', '③'] },
  { id: 'upper-roman', title: 'I. II. III.', samples: ['I.', 'II.', 'III.'] },
  { id: 'upper-alpha', title: 'A. B. C.', samples: ['A.', 'B.', 'C.'] },
  { id: 'lower-alpha-paren', title: 'a) b) c)', samples: ['a)', 'b)', 'c)'] },
  { id: 'lower-alpha', title: 'a. b. c.', samples: ['a.', 'b.', 'c.'] },
]
const LIST_MORE = [
  { id: 'decimal-zero', title: '01. 02. 03.' },
  { id: 'lower-roman', title: 'i. ii. iii.' },
  { id: 'paren-decimal', title: '(1) (2) (3)' },
  { id: 'cjk', title: '一、二、三、' },
  { id: 'cjk-heavenly', title: '甲、乙、丙、' },
]
const listOpen = ref(false)
const listMore = ref(false)
const listStyle = ref('')

function onDocDown(e) {
  if (!listOpen.value) return
  if (e.target?.closest?.('.rn-list-wrap')) return
  listOpen.value = false
  listMore.value = false
}
watch(() => props.visible, (v) => {
  if (!v) {
    listOpen.value = false
    listMore.value = false
    document.removeEventListener('mousedown', onDocDown, true)
  } else {
    document.addEventListener('mousedown', onDocDown, true)
  }
})
onBeforeUnmount(() => document.removeEventListener('mousedown', onDocDown, true))

watch(() => props.visible, async (v) => {
  window.clearTimeout(focusTimer)
  if (!v) {
    savedRange = null
    return
  }
  await nextTick()
  const el = editorEl.value
  if (!el) return
  el.innerHTML = normalizeIncoming(props.html)
  blockMode.value = 'p'
  fontSize.value = '12'
  syncEmpty()
  focusTimer = window.setTimeout(() => focusEditor(true), 40)
})

onBeforeUnmount(() => window.clearTimeout(focusTimer))

function normalizeIncoming(html) {
  const raw = String(html || '').trim()
  if (!raw || isBlankHtml(raw)) return '<p><br></p>'
  return raw
}

function isBlankHtml(html) {
  return !String(html || '')
    .replace(/<br\s*\/?>/gi, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, '')
}

function syncEmpty() {
  empty.value = isBlankHtml(editorEl.value?.innerHTML || '')
}

function focusEditor(toEnd = false) {
  const el = editorEl.value
  if (!el) return
  el.focus({ preventScroll: true })
  try { document.execCommand('styleWithCSS', false, true) } catch { /* ignore */ }
  const sel = window.getSelection()
  if (!sel) return
  if (!toEnd && savedRange && el.contains(savedRange.commonAncestorContainer)) {
    sel.removeAllRanges()
    sel.addRange(savedRange)
    return
  }
  const range = document.createRange()
  range.selectNodeContents(el)
  range.collapse(false)
  sel.removeAllRanges()
  sel.addRange(range)
  savedRange = range.cloneRange()
}

function saveSelection() {
  const el = editorEl.value
  const sel = window.getSelection()
  if (!el || !sel || !sel.rangeCount) return
  const node = sel.anchorNode
  if (node && el.contains(node)) savedRange = sel.getRangeAt(0).cloneRange()
}

function restoreSelection() {
  const el = editorEl.value
  if (!el) return false
  el.focus({ preventScroll: true })
  const sel = window.getSelection()
  if (!sel) return false
  if (savedRange && (el === savedRange.commonAncestorContainer || el.contains(savedRange.commonAncestorContainer))) {
    sel.removeAllRanges()
    sel.addRange(savedRange)
    return true
  }
  const range = document.createRange()
  range.selectNodeContents(el)
  range.collapse(false)
  sel.removeAllRanges()
  sel.addRange(range)
  savedRange = range.cloneRange()
  return true
}

function onBarDown(e) {
  if (e.target.closest('select, input')) return
  e.preventDefault()
}

function selectionInEditor() {
  const el = editorEl.value
  const sel = window.getSelection()
  return !!(el && sel?.rangeCount && sel.anchorNode && el.contains(sel.anchorNode))
}

function exec(cmd, val = null) {
  if (!selectionInEditor()) restoreSelection()
  else editorEl.value?.focus({ preventScroll: true })
  document.execCommand(cmd, false, val)
  saveSelection()
  syncBlockMode()
  syncEmpty()
}

function applyFontSize(size) {
  fontSize.value = size
  restoreSelection()
  document.execCommand('fontSize', false, '7')
  editorEl.value?.querySelectorAll('font[size="7"]').forEach((node) => {
    const span = document.createElement('span')
    span.style.fontSize = `${size}px`
    span.innerHTML = node.innerHTML
    node.replaceWith(span)
  })
  saveSelection()
}

function applyBlock(tag) {
  blockMode.value = tag
  exec('formatBlock', `<${tag}>`)
}

function syncBlockMode() {
  const sel = document.getSelection()
  let node = sel?.anchorNode
  const ol = closestList('OL')
  listStyle.value = ol ? (ol.getAttribute('data-list') || 'decimal') : ''
  while (node && node !== editorEl.value) {
    const tag = node.nodeName?.toLowerCase()
    if (tag === 'h3' || tag === 'h4' || tag === 'blockquote') { blockMode.value = tag; return }
    if (tag === 'p' || tag === 'div') { blockMode.value = 'p'; return }
    node = node.parentNode
  }
}

function applyColor(kind, e) {
  exec(kind, e.target.value)
}

function addLink() {
  restoreSelection()
  const sel = document.getSelection()
  const text = sel?.toString() || ''
  const url = window.prompt('请输入链接地址', 'https://')
  if (!url || url === 'https://') return
  restoreSelection()
  if (!text) {
    document.execCommand('insertHTML', false, `<a href="${url}" target="_blank" rel="noopener">${url}</a>`)
  } else {
    document.execCommand('createLink', false, url)
  }
  saveSelection()
  syncEmpty()
}

function addImage() {
  const url = window.prompt('请输入图片地址', 'https://')
  if (!url || url === 'https://') return
  exec('insertHTML', `<img src="${url}" alt="" style="max-width:100%">`)
}

function clearFormat() {
  exec('removeFormat')
  exec('unlink')
}

function closestList(tag) {
  const el = editorEl.value
  const sel = window.getSelection()
  let node = sel?.anchorNode
  if (!node || !el) return null
  if (node.nodeType === 3) node = node.parentElement
  while (node && node !== el) {
    if (node.tagName === tag) return node
    node = node.parentElement
  }
  return null
}

function applyOlKind(ol, id) {
  if (!ol) return
  ol.removeAttribute('style')
  ol.className = ''
  if (id === 'decimal') {
    ol.style.listStyleType = 'decimal'
    ol.removeAttribute('data-list')
    return
  }
  ol.setAttribute('data-list', id)
  const css = {
    'upper-roman': 'upper-roman',
    'lower-roman': 'lower-roman',
    'upper-alpha': 'upper-alpha',
    'lower-alpha': 'lower-alpha',
    'decimal-zero': 'decimal-leading-zero',
    cjk: 'simp-chinese-informal',
    'cjk-heavenly': 'cjk-heavenly-stem',
  }[id]
  ol.style.listStyleType = css || 'none'
}

function applyList(id) {
  restoreSelection()
  const ol = closestList('OL')
  if (id === 'none') {
    if (ol) exec('insertOrderedList')
    listStyle.value = ''
    listOpen.value = false
    listMore.value = false
    return
  }
  if (!ol) exec('insertOrderedList')
  nextTick(() => {
    const cur = closestList('OL')
    applyOlKind(cur, id)
    listStyle.value = id
    listOpen.value = false
    listMore.value = false
    saveSelection()
    syncEmpty()
  })
}

function toggleListPop() {
  listOpen.value = !listOpen.value
  if (!listOpen.value) listMore.value = false
}

function onBodyInput() {
  saveSelection()
  syncEmpty()
}

function onBodyKeydown(e) {
  e.stopPropagation()
}

function onOk() {
  const html = editorEl.value?.innerHTML || ''
  emit('ok', isBlankHtml(html) ? '' : html)
  emit('update:visible', false)
}

function onCancel() {
  emit('update:visible', false)
}
</script>

<template>
  <AppModal
    :visible="visible"
    :title="title"
    icon="edit-fill"
    :width="720"
    :z-index="3600"
    overflow-visible
    foot-end
    @update:visible="emit('update:visible', $event)"
  >
    <div class="rn-editor" @keydown="onBodyKeydown">
      <div class="rn-toolbar" @mousedown="onBarDown">
        <div class="rn-row">
          <select class="rn-sel rn-block" :value="blockMode" title="段落样式" @change="applyBlock($event.target.value)">
            <option v-for="b in BLOCK_OPTIONS" :key="b.value" :value="b.value">{{ b.label }}</option>
          </select>
          <select class="rn-sel rn-size" :value="fontSize" title="字号" @change="applyFontSize($event.target.value)">
            <option v-for="s in SIZE_OPTIONS" :key="s" :value="s">{{ s }}</option>
          </select>
          <span class="rn-split" />
          <button type="button" class="rn-btn rn-b" title="加粗" @click="exec('bold')"><b>B</b></button>
          <button type="button" class="rn-btn rn-i" title="斜体" @click="exec('italic')"><i>I</i></button>
          <button type="button" class="rn-btn" title="下划线" @click="exec('underline')"><u>U</u></button>
          <button type="button" class="rn-btn rn-strike" title="删除线" @click="exec('strikeThrough')"><s>S</s></button>
          <label class="rn-btn rn-color" title="文字颜色">
            <span class="rn-a">A</span>
            <input type="color" value="#1d2129" @input="applyColor('foreColor', $event)">
          </label>
          <label class="rn-btn rn-color" title="背景颜色">
            <span class="rn-a rn-hl">A</span>
            <input type="color" value="#fff59d" @input="applyColor('hiliteColor', $event)">
          </label>
          <span class="rn-split" />
          <button type="button" class="rn-btn" title="左对齐" @click="exec('justifyLeft')">左</button>
          <button type="button" class="rn-btn" title="居中" @click="exec('justifyCenter')">中</button>
          <button type="button" class="rn-btn" title="右对齐" @click="exec('justifyRight')">右</button>
        </div>
        <div class="rn-row">
          <div class="rn-list-wrap">
            <button type="button" class="rn-btn" title="编号" :class="{ on: listOpen || listStyle }" @click="toggleListPop">1.</button>
            <div v-if="listOpen" class="rn-list-pop" @mousedown.prevent>
              <div class="rn-list-grid">
                <button type="button" class="rn-list-none" :class="{ on: !listStyle }" @click="applyList('none')">无</button>
                <button
                  v-for="item in LIST_MAIN"
                  :key="item.id"
                  type="button"
                  class="rn-list-card"
                  :class="{ on: listStyle === item.id }"
                  :title="item.title"
                  @click="applyList(item.id)"
                >
                  <span v-for="s in item.samples" :key="s">{{ s }}————</span>
                </button>
              </div>
              <button type="button" class="rn-list-more" @click="listMore = !listMore">其他编号…</button>
              <div v-if="listMore" class="rn-list-extra">
                <button
                  v-for="item in LIST_MORE"
                  :key="item.id"
                  type="button"
                  :class="{ on: listStyle === item.id }"
                  @click="applyList(item.id)"
                >{{ item.title }}</button>
              </div>
            </div>
          </div>
          <button type="button" class="rn-btn" title="无序列表" @click="exec('insertUnorderedList')">•</button>
          <button type="button" class="rn-btn" title="增加缩进" @click="exec('indent')">⇥</button>
          <span class="rn-split" />
          <button type="button" class="rn-btn" title="链接" @click="addLink">链</button>
          <button type="button" class="rn-btn" title="图片" @click="addImage">图</button>
          <button type="button" class="rn-btn rn-quote" title="引用" @click="applyBlock('blockquote')">&ldquo;</button>
          <button type="button" class="rn-btn" title="分隔线" @click="exec('insertHorizontalRule')">—</button>
          <button type="button" class="rn-btn" title="清除格式" @click="clearFormat">清</button>
        </div>
      </div>

      <div class="rn-body-wrap">
        <div v-if="empty" class="rn-ph">{{ placeholder }}</div>
        <div
          ref="editorEl"
          class="rn-body rich-note"
          contenteditable="true"
          tabindex="0"
          spellcheck="false"
          @keydown="onBodyKeydown"
          @keyup="saveSelection(); syncBlockMode()"
          @mouseup="saveSelection(); syncBlockMode()"
          @input="onBodyInput"
          @focus="saveSelection"
        />
      </div>
    </div>

    <template #footer>
      <button type="button" class="btn tint" @click="onCancel">取消</button>
      <button type="button" class="btn primary" @click="onOk">确定</button>
    </template>
  </AppModal>
</template>

<style scoped>
.rn-editor {
  border: 1px solid var(--border, #e3e6eb);
  border-radius: 6px;
  overflow: visible;
  background: #fff;
}
.rn-toolbar {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 10px;
  border-bottom: 1px solid var(--border, #e3e6eb);
  background: #f7f8fa;
  user-select: none;
}
.rn-row {
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
  gap: 2px;
}
.rn-split {
  width: 1px;
  height: 16px;
  margin: 0 4px;
  background: #e3e6eb;
  flex-shrink: 0;
}
.rn-sel {
  height: 28px;
  border: 1px solid var(--border, #e3e6eb);
  border-radius: 4px;
  background: #fff;
  font-size: 12px;
  color: #1d2129;
  padding: 0 6px;
  cursor: pointer;
  outline: none;
}
.rn-block { width: 72px; }
.rn-size { width: 52px; }
.rn-btn {
  min-width: 28px;
  height: 28px;
  padding: 0 6px;
  border: none;
  background: none;
  border-radius: 4px;
  color: #1d2129;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  font-family: inherit;
  font-size: 13px;
  flex-shrink: 0;
}
.rn-btn:hover { background: #e8eaee; }
.rn-btn.on { background: #e8f0ff; color: #1664ff; }
.rn-list-wrap { position: relative; }
.rn-list-pop {
  position: absolute;
  left: 0;
  top: calc(100% + 4px);
  z-index: 20;
  width: 268px;
  padding: 8px;
  background: #fff;
  border: 1px solid #e3e6eb;
  border-radius: 6px;
  box-shadow: 0 8px 24px rgba(29, 33, 41, .12);
}
.rn-list-grid {
  display: grid;
  grid-template-columns: 52px 1fr 1fr 1fr;
  grid-template-rows: auto auto;
  gap: 4px;
  align-items: stretch;
}
.rn-list-none {
  grid-row: 1 / span 2;
  border: 1px solid #e3e6eb;
  border-radius: 4px;
  background: #f7f8fa;
  color: #4e5969;
  font-size: 13px;
  cursor: pointer;
}
.rn-list-none.on,
.rn-list-card.on,
.rn-list-extra button.on { border-color: #1664ff; background: #e8f0ff; color: #1664ff; }
.rn-list-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1px;
  padding: 4px 6px;
  border: 1px solid #e3e6eb;
  border-radius: 4px;
  background: #fff;
  color: #1d2129;
  font-size: 11px;
  line-height: 1.35;
  cursor: pointer;
  font-family: inherit;
}
.rn-list-card:hover,
.rn-list-none:hover,
.rn-list-extra button:hover { background: #f7f8fa; }
.rn-list-more {
  margin-top: 6px;
  width: 100%;
  height: 28px;
  border: none;
  background: none;
  color: #1d2129;
  font-size: 12px;
  text-align: left;
  cursor: pointer;
  padding: 0 4px;
}
.rn-list-extra {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 4px;
}
.rn-list-extra button {
  height: 26px;
  padding: 0 8px;
  border: 1px solid #e3e6eb;
  border-radius: 4px;
  background: #fff;
  font-size: 12px;
  cursor: pointer;
  font-family: inherit;
}
.rn-b { font-weight: 700; }
.rn-i { font-style: italic; }
.rn-strike { font-size: 13px; }
.rn-quote { font-size: 16px; font-weight: 700; }
.rn-color { position: relative; overflow: hidden; }
.rn-color input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
.rn-a { font-weight: 700; }
.rn-hl { text-decoration: underline; text-decoration-color: #f7ba1e; text-underline-offset: 2px; }
.rn-body-wrap { position: relative; background: #fff; }
.rn-ph {
  position: absolute;
  top: 12px;
  left: 14px;
  color: #a9aeb8;
  font-size: 13px;
  line-height: 1.7;
  pointer-events: none;
  z-index: 1;
}
.rn-body {
  min-height: 240px;
  max-height: 380px;
  overflow: auto;
  padding: 12px 14px;
  font-size: 13px;
  line-height: 1.7;
  color: #1d2129;
  outline: none;
  background: transparent;
  caret-color: #1d2129;
  user-select: text;
  -webkit-user-select: text;
}
.rn-body :deep(b), .rn-body :deep(strong) { font-weight: 700; }
.rn-body :deep(blockquote) {
  margin: 6px 0; padding: 2px 10px; border-left: 3px solid #dcdfe4; color: #4e5969;
}
.rn-body :deep(ol), .rn-body :deep(ul) { margin: 4px 0; padding-left: 22px; }
.rn-body :deep(ol[data-list="circled"]),
.rn-body :deep(ol[data-list="lower-alpha-paren"]),
.rn-body :deep(ol[data-list="paren-decimal"]) { list-style: none; padding-left: 1.6em; }
.rn-body :deep(ol[data-list="circled"]) > li,
.rn-body :deep(ol[data-list="lower-alpha-paren"]) > li,
.rn-body :deep(ol[data-list="paren-decimal"]) > li { position: relative; }
.rn-body :deep(ol[data-list="circled"]) { counter-reset: rn-ol; }
.rn-body :deep(ol[data-list="circled"]) > li { counter-increment: rn-ol; }
.rn-body :deep(ol[data-list="circled"]) > li::before { position: absolute; left: -1.5em; content: counter(rn-ol, circled-decimal) " "; }
.rn-body :deep(ol[data-list="lower-alpha-paren"]) { counter-reset: rn-ol; }
.rn-body :deep(ol[data-list="lower-alpha-paren"]) > li { counter-increment: rn-ol; }
.rn-body :deep(ol[data-list="lower-alpha-paren"]) > li::before { position: absolute; left: -1.5em; content: counter(rn-ol, lower-alpha) ") "; }
.rn-body :deep(ol[data-list="paren-decimal"]) { counter-reset: rn-ol; }
.rn-body :deep(ol[data-list="paren-decimal"]) > li { counter-increment: rn-ol; }
.rn-body :deep(ol[data-list="paren-decimal"]) > li::before { position: absolute; left: -1.5em; content: "(" counter(rn-ol) ") "; }
.rn-body :deep(a) { color: #2e74ff; }
.rn-body :deep(hr) { border: none; border-top: 1px solid #dcdfe4; margin: 8px 0; }
.rn-body :deep(img) { max-width: 100%; }
.rn-body :deep(p) { margin: 0; }
.rn-body :deep(h3) { margin: 0 0 6px; font-size: 16px; }
.rn-body :deep(h4) { margin: 0 0 4px; font-size: 14px; }
</style>
