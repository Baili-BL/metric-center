<script setup>
import { nextTick, ref, watch } from 'vue'
import Icon from './Icon.vue'

/**
 * 备注内容 / 尾注内容 富文本编辑弹窗（工具栏图标与设计稿一致，用 i-rte-* 图标）
 * - contenteditable + document.execCommand，输出 HTML 片段
 */
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

const BLOCK_OPTIONS = [
  { value: 'p', label: '正文' },
  { value: 'h3', label: '标题1' },
  { value: 'h4', label: '标题2' },
]
const SIZE_OPTIONS = ['12', '13', '14', '16', '18', '20', '24']

watch(() => props.visible, async (v) => {
  if (!v) return
  await nextTick()
  if (editorEl.value) editorEl.value.innerHTML = props.html || ''
  blockMode.value = 'p'
  fontSize.value = '12'
})

function focusEditor() {
  editorEl.value?.focus()
}

function exec(cmd, val = null) {
  focusEditor()
  const ok = document.execCommand(cmd, false, val)
  // Safari 不支持 hiliteColor，回退 backColor
  if (!ok && cmd === 'hiliteColor') document.execCommand('backColor', false, val)
  syncBlockMode()
}

/** 字号：execCommand 只支持 1-7，先打 tag 再替换为精确 px */
function applyFontSize(size) {
  fontSize.value = size
  focusEditor()
  document.execCommand('fontSize', false, '7')
  editorEl.value?.querySelectorAll('font[size="7"]').forEach((el) => {
    const span = document.createElement('span')
    span.style.fontSize = size + 'px'
    span.innerHTML = el.innerHTML
    el.replaceWith(span)
  })
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
  const sel = document.getSelection()
  const text = sel?.toString() || ''
  const url = window.prompt('请输入链接地址', 'https://')
  if (!url || url === 'https://') return
  focusEditor()
  if (!text) {
    document.execCommand('insertHTML', false, `<a href="${url}" target="_blank" rel="noopener">${url}</a>`)
  } else {
    document.execCommand('createLink', false, url)
  }
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

function onOk() {
  emit('ok', editorEl.value?.innerHTML || '')
  emit('update:visible', false)
}

function onCancel() {
  emit('update:visible', false)
}
</script>

<template>
  <a-modal
    :visible="visible"
    :title="title"
    :width="640"
    unmount-on-close
    :mask-closable="false"
    @update:visible="emit('update:visible', $event)"
  >
    <div class="rn-editor">
      <div class="rn-toolbar" @mousedown.prevent>
        <select class="rn-sel rn-block" :value="blockMode" title="段落样式" @change="applyBlock($event.target.value)">
          <option v-for="b in BLOCK_OPTIONS" :key="b.value" :value="b.value">{{ b.label }}</option>
        </select>

        <select class="rn-sel rn-size" :value="fontSize" title="字号" @change="applyFontSize($event.target.value)">
          <option v-for="s in SIZE_OPTIONS" :key="s" :value="s">{{ s }}</option>
        </select>

        <button type="button" class="rn-btn" title="加粗" @click="exec('bold')"><Icon name="rte-bold" :size="14" /></button>
        <button type="button" class="rn-btn" title="斜体" @click="exec('italic')"><Icon name="rte-italic" :size="14" /></button>
        <button type="button" class="rn-btn" title="下划线" @click="exec('underline')"><Icon name="rte-underline" :size="14" /></button>
        <button type="button" class="rn-btn rn-strike" title="删除线" @click="exec('strikeThrough')"><s>S</s></button>

        <label class="rn-btn rn-color" title="文字颜色">
          <Icon name="rte-font-color" :size="14" />
          <input type="color" value="#1d2129" @input="applyColor('foreColor', $event)">
        </label>
        <label class="rn-btn rn-color" title="背景颜色">
          <Icon name="rte-font-color-2" :size="14" />
          <input type="color" value="#ffffff" @input="applyColor('hiliteColor', $event)">
        </label>

        <button type="button" class="rn-btn" title="左对齐" @click="exec('justifyLeft')"><Icon name="rte-align" :size="14" /></button>
        <button type="button" class="rn-btn" title="居中" @click="exec('justifyCenter')"><Icon name="rte-align" :size="14" /></button>
        <button type="button" class="rn-btn" title="右对齐" @click="exec('justifyRight')"><Icon name="rte-align" :size="14" /></button>

        <button type="button" class="rn-btn" title="有序列表" @click="exec('insertOrderedList')"><Icon name="rte-ol" :size="14" /></button>
        <button type="button" class="rn-btn" title="无序列表" @click="exec('insertUnorderedList')"><Icon name="rte-ul" :size="14" /></button>
        <button type="button" class="rn-btn" title="增加缩进" @click="exec('indent')"><Icon name="rte-indent" :size="14" /></button>

        <button type="button" class="rn-btn" title="链接" @click="addLink"><Icon name="rte-link" :size="14" /></button>
        <button type="button" class="rn-btn" title="图片" @click="addImage"><Icon name="rte-image" :size="14" /></button>
        <button type="button" class="rn-btn rn-quote" title="引用" @click="applyBlock('blockquote')">&ldquo;</button>
        <button type="button" class="rn-btn" title="分隔线" @click="exec('insertHorizontalRule')"><Icon name="rte-hr" :size="14" /></button>
        <button type="button" class="rn-btn" title="清除格式" @click="clearFormat"><Icon name="rte-clear" :size="14" /></button>
      </div>

      <div
        ref="editorEl"
        class="rn-body"
        contenteditable="true"
        :data-placeholder="placeholder"
        spellcheck="false"
        @keyup="syncBlockMode"
        @mouseup="syncBlockMode"
      ></div>
    </div>

    <template #footer>
      <button type="button" class="btn" @click="onCancel">取 消</button>
      <button type="button" class="btn primary" @click="onOk">确 定</button>
    </template>
  </a-modal>
</template>

<style scoped>
.rn-editor { border: 1px solid var(--border, #e3e6eb); border-radius: 6px; overflow: hidden; }
.rn-toolbar {
  display: flex; align-items: center; flex-wrap: wrap; gap: 2px;
  padding: 6px 8px; border-bottom: 1px solid var(--border, #e3e6eb); background: #f7f8fa;
  user-select: none;
}
.rn-sel {
  height: 26px; border: 1px solid var(--border, #e3e6eb); border-radius: 4px;
  background: #fff; font-size: 12px; color: #1d2129; padding: 0 4px; cursor: pointer;
}
.rn-block { width: 76px; }
.rn-size { width: 54px; }
.rn-btn {
  min-width: 26px; height: 26px; padding: 0 5px; border: none; background: none;
  border-radius: 4px; color: #1d2129; cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center; line-height: 1;
  font-family: inherit;
}
.rn-btn:hover { background: #e8eaee; }
.rn-strike { font-size: 13px; }
.rn-quote { font-size: 17px; font-weight: 700; }
.rn-color { position: relative; }
.rn-color input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
.rn-body {
  min-height: 240px; max-height: 380px; overflow: auto;
  padding: 12px 14px; font-size: 13px; line-height: 1.7; color: #1d2129;
  outline: none; background: #fff;
}
.rn-body:empty::before { content: attr(data-placeholder); color: #a9aeb8; }
.rn-body :deep(b), .rn-body :deep(strong) { font-weight: 700; }
.rn-body :deep(blockquote) {
  margin: 6px 0; padding: 2px 10px; border-left: 3px solid #dcdfe4; color: #4e5969;
}
.rn-body :deep(ol), .rn-body :deep(ul) { margin: 4px 0; padding-left: 22px; }
.rn-body :deep(a) { color: #2e74ff; }
.rn-body :deep(hr) { border: none; border-top: 1px solid #dcdfe4; margin: 8px 0; }
</style>
