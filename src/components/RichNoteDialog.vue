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
          <button type="button" class="rn-btn" title="有序列表" @click="exec('insertOrderedList')">1.</button>
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
          class="rn-body"
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
  overflow: hidden;
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
.rn-body :deep(a) { color: #2e74ff; }
.rn-body :deep(hr) { border: none; border-top: 1px solid #dcdfe4; margin: 8px 0; }
.rn-body :deep(img) { max-width: 100%; }
.rn-body :deep(p) { margin: 0; }
.rn-body :deep(h3) { margin: 0 0 6px; font-size: 16px; }
.rn-body :deep(h4) { margin: 0 0 4px; font-size: 14px; }
</style>
