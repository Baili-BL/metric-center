<script setup>
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue'
import Icon from '../../components/Icon.vue'
import ColorPop, { placeColorPop } from '../../components/ColorPop.vue'
import { COVER_TEMPLATES, TEXT_SIZES, clone, coverTextStyle, emptyCoverText, htmlFontsToEm, resolveFontFamily } from './ppt-model'
import PptSlide from './PptSlide.vue'
import PptFontSelect from './PptFontSelect.vue'

const props = defineProps({
  visible: Boolean,
  cover: { type: Object, default: null },
  canEdit: { type: Boolean, default: true },
})
const emit = defineEmits(['update:visible', 'save'])

const local = ref(null)
const sel = ref(-1)
const editing = ref(-1)
const pickTpl = ref(false)
const stageEl = ref(null)
const boxEls = ref({})
const drag = ref(null)
const HANDLES = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']
const COVER_SIZES = [...new Set([...TEXT_SIZES, 32, 40, 56, 64, 72, 88])].sort((a, b) => a - b)
const colorPick = reactive({ show: false, left: 0, top: 0, origin: '#ffffff' })

const texts = computed(() => local.value?.texts || [])
const cur = computed(() => texts.value[sel.value] || null)
const previewSlide = computed(() => ({
  kind: 'cover',
  title: local.value?.title || '',
  cover: local.value,
}))
const darkTpl = computed(() => local.value?.template === 'light')

watch(() => props.visible, (v) => {
  if (!v) {
    sel.value = -1
    editing.value = -1
    pickTpl.value = false
    return
  }
  const c = clone(props.cover || {})
  if (!Array.isArray(c.texts)) c.texts = []
  local.value = c
})

function close() {
  emit('update:visible', false)
}
function save() {
  flushEdit()
  emit('save', clone(local.value))
  emit('update:visible', false)
}
function setTpl(id) {
  if (!local.value) return
  local.value.template = id
  pickTpl.value = false
}

function setBoxEl(el, i) {
  if (el) boxEls.value[i] = el
  else delete boxEls.value[i]
}
function designRect() {
  return stageEl.value?.querySelector('.cover-design')?.getBoundingClientRect()
    || stageEl.value?.getBoundingClientRect()
}

function addText(x, y) {
  if (!props.canEdit || !local.value) return
  flushEdit()
  const t = emptyCoverText(
    x == null ? undefined : Math.max(2, Math.min(70, x)),
    y == null ? undefined : Math.max(4, Math.min(70, y)),
    darkTpl.value,
    local.value.template || 'city',
  )
  local.value.texts = [...(local.value.texts || []), t]
  sel.value = local.value.texts.length - 1
  nextTick(() => startEdit(sel.value))
}
function onStageClick(e) {
  if (e.target.closest('.pcs-box')) return
  flushEdit()
  sel.value = -1
}
function onStageDblclick(e) {
  if (!props.canEdit) return
  if (e.target.closest('.pcs-box')) return
  const rect = designRect()
  if (!rect) return addText()
  const x = ((e.clientX - rect.left) / rect.width) * 100
  const y = ((e.clientY - rect.top) / rect.height) * 100
  addText(x - 10, y - 6)
}
function selectBox(i, e) {
  e?.stopPropagation()
  if (sel.value !== i) flushEdit()
  sel.value = i
}
function startEdit(i) {
  if (!props.canEdit) return
  sel.value = i
  editing.value = i
  nextTick(() => {
    const el = boxEls.value[i]
    if (!el) return
    el.innerHTML = htmlFontsToEm(local.value.texts[i]?.html || '', local.value.texts[i]?.fontSize)
    el.focus()
    const range = document.createRange()
    range.selectNodeContents(el)
    range.collapse(false)
    const s = window.getSelection()
    s.removeAllRanges()
    s.addRange(range)
  })
}
function flushEdit() {
  const i = editing.value
  if (i < 0) return
  const el = boxEls.value[i]
  const t = local.value?.texts?.[i]
  if (el && t) t.html = htmlFontsToEm(el.innerHTML, t.fontSize)
  editing.value = -1
}
function removeSel() {
  if (sel.value < 0 || !local.value) return
  local.value.texts.splice(sel.value, 1)
  sel.value = -1
  editing.value = -1
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n))
}
function applyDrag(ev) {
  const d = drag.value
  if (!d || !local.value) return
  const dx = ((ev.clientX - d.x) / d.rect.width) * 100
  const dy = ((ev.clientY - d.y) / d.rect.height) * 100
  let { x, y, w, h } = d.box
  const dir = d.dir
  if (dir === 'move') {
    x = clamp(x + dx, 0, 100 - w)
    y = clamp(y + dy, 0, 100 - h)
  } else {
    if (dir.includes('e')) w = clamp(w + dx, 8, 100 - x)
    if (dir.includes('s')) h = clamp(h + dy, 6, 100 - y)
    if (dir.includes('w')) {
      const nx = clamp(x + dx, 0, x + w - 8)
      w += x - nx
      x = nx
    }
    if (dir.includes('n')) {
      const ny = clamp(y + dy, 0, y + h - 6)
      h += y - ny
      y = ny
    }
  }
  const t = local.value.texts[d.index]
  if (!t) return
  t.x = Math.round(x * 10) / 10
  t.y = Math.round(y * 10) / 10
  t.w = Math.round(w * 10) / 10
  t.h = Math.round(h * 10) / 10
}
function onMove(ev) { applyDrag(ev) }
function onUp() {
  window.removeEventListener('pointermove', onMove)
  window.removeEventListener('pointerup', onUp)
  drag.value = null
}
function startResize(e, i, dir) {
  if (!props.canEdit) return
  e.preventDefault()
  e.stopPropagation()
  flushEdit()
  sel.value = i
  const t = local.value.texts[i]
  drag.value = {
    index: i,
    dir,
    x: e.clientX,
    y: e.clientY,
    box: { x: t.x, y: t.y, w: t.w, h: t.h },
    rect: designRect(),
  }
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
}

function focusBox() {
  boxEls.value[sel.value]?.focus()
}
function exec(cmd, val = null) {
  if (sel.value < 0) return
  if (editing.value !== sel.value) startEdit(sel.value)
  nextTick(() => {
    focusBox()
    document.execCommand(cmd, false, val)
    const t = cur.value
    const el = boxEls.value[sel.value]
    if (t && el) t.html = htmlFontsToEm(el.innerHTML, t.fontSize)
  })
}
const coverFont = computed({
  get: () => resolveFontFamily(cur.value?.fontFamily),
  set: (fam) => applyFont(fam),
})
const coverSize = computed({
  get: () => Number(cur.value?.fontSize) || 32,
  set: (size) => applyFontSize(size),
})
function applyFontSize(size) {
  const t = cur.value
  if (!t) return
  t.fontSize = Number(size)
  const el = boxEls.value[sel.value]
  if (el) t.html = htmlFontsToEm(el.innerHTML, t.fontSize)
}
function applyFont(fam) {
  const t = cur.value
  if (!t) return
  t.fontFamily = fam
  exec('fontName', fam)
}
function applyAlign(a) {
  const t = cur.value
  if (!t) return
  t.align = a
  exec({ left: 'justifyLeft', center: 'justifyCenter', right: 'justifyRight' }[a])
}
function toggle(key, cmd) {
  const t = cur.value
  if (!t) return
  t[key] = !t[key]
  exec(cmd)
}
function applyColor(hex) {
  const t = cur.value
  if (!t) return
  t.color = hex
  exec('foreColor', hex)
}
function openCoverColor(e) {
  if (!cur.value) return
  const pos = placeColorPop(e.currentTarget)
  colorPick.origin = cur.value.color || '#ffffff'
  colorPick.left = pos.left
  colorPick.top = pos.top
  colorPick.show = true
}

function onKey(e) {
  if (!props.visible) return
  if (e.key === 'Escape') {
    if (editing.value >= 0) { flushEdit(); return }
    close()
  }
  if ((e.key === 'Delete' || e.key === 'Backspace') && editing.value < 0 && sel.value >= 0) {
    e.preventDefault()
    removeSel()
  }
}

watch(() => props.visible, (v) => {
  if (v) window.addEventListener('keydown', onKey)
  else window.removeEventListener('keydown', onKey)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  window.removeEventListener('pointermove', onMove)
  window.removeEventListener('pointerup', onUp)
})

function onBoxInput(i, e) {
  const t = local.value?.texts?.[i]
  if (t) t.html = htmlFontsToEm(e.target.innerHTML, t.fontSize)
}
</script>

<template>
  <Teleport to="body">
    <div v-if="visible && local" class="pcs-mask" @mousedown.self="close">
      <div class="pcs" role="dialog" aria-modal="true" aria-label="自定义封面页">
        <header class="pcs-head">
          <span>自定义封面页</span>
          <button type="button" class="pcs-x" aria-label="关闭" @click="close">✕</button>
        </header>
        <div class="pcs-body">
          <div class="pcs-stage-wrap">
            <div
              ref="stageEl"
              class="pcs-stage"
              @click="onStageClick"
              @dblclick="onStageDblclick"
            >
              <PptSlide :slide="previewSlide" :template="local.template || 'city'">
                <template #cover-overlay>
                  <div
                    v-for="(t, i) in texts"
                    :key="t.id"
                    class="pcs-box"
                    :class="{ on: sel === i, editing: editing === i }"
                    :style="coverTextStyle(t)"
                    @pointerdown.stop="editing !== i && startResize($event, i, 'move')"
                    @click.stop="selectBox(i, $event)"
                    @dblclick.stop="startEdit(i)"
                  >
                    <div
                      v-show="editing !== i"
                      class="pcs-box-ed"
                      :data-placeholder="'点击输入文本内容'"
                      v-html="t.html"
                    />
                    <div
                      v-show="editing === i"
                      :ref="(el) => setBoxEl(el, i)"
                      class="pcs-box-ed"
                      contenteditable="true"
                      data-placeholder="点击输入文本内容"
                      spellcheck="false"
                      @input="onBoxInput(i, $event)"
                      @blur="flushEdit"
                    />
                    <template v-if="canEdit && sel === i">
                      <i v-for="h in HANDLES" :key="h" class="pcs-handle" :class="h" @pointerdown.stop="startResize($event, i, h)" />
                    </template>
                  </div>
                </template>
              </PptSlide>
            </div>
          </div>
          <aside class="pcs-side">
            <label class="pcs-req">PPT标题</label>
            <input v-model="local.title" class="pcs-title" :disabled="!canEdit" placeholder="请输入标题">
            <label class="pcs-req pcs-opt">名字</label>
            <input v-model="local.author" class="pcs-title" :disabled="!canEdit" placeholder="名字">
            <label class="pcs-req pcs-opt">编号</label>
            <input v-model="local.date" class="pcs-title" :disabled="!canEdit" placeholder="编号">
            <div class="pcs-insert">
              <span>插入文本</span>
              <button type="button" class="pcs-t" :disabled="!canEdit" title="插入文本" @click="addText()">T</button>
            </div>
            <div v-if="cur" class="pcs-fmt">
              <div class="pcs-fmt-label">文本设置</div>
              <div class="pcs-bar" @mousedown.prevent>
                <button type="button" class="rn-btn" title="左对齐" @click="applyAlign('left')"><Icon name="rte-align" :size="14" /></button>
                <button type="button" class="rn-btn" title="居中" @click="applyAlign('center')"><Icon name="rte-align" :size="14" /></button>
                <button type="button" class="rn-btn" title="右对齐" @click="applyAlign('right')"><Icon name="rte-align" :size="14" /></button>
                <button
                  type="button"
                  class="fmt-color color-well"
                  title="文字颜色"
                  :style="{ '--swatch': cur.color }"
                  @click.stop="openCoverColor"
                >A</button>
                <button type="button" class="rn-btn" title="加粗" @click="toggle('bold', 'bold')"><Icon name="rte-bold" :size="14" /></button>
                <button type="button" class="rn-btn" title="斜体" @click="toggle('italic', 'italic')"><Icon name="rte-italic" :size="14" /></button>
                <button type="button" class="rn-btn" title="下划线" @click="toggle('underline', 'underline')"><Icon name="rte-underline" :size="14" /></button>
                <button type="button" class="rn-btn rn-strike" title="删除线" @click="toggle('strike', 'strikeThrough')"><s>S</s></button>
                <button type="button" class="rn-btn" title="有序列表" @click="exec('insertOrderedList')"><Icon name="rte-ol" :size="14" /></button>
                <button type="button" class="rn-btn" title="无序列表" @click="exec('insertUnorderedList')"><Icon name="rte-ul" :size="14" /></button>
              </div>
              <div class="pcs-bar">
                <PptFontSelect v-model="coverFont" />
                <a-select v-model="coverSize" size="small" popup-container="body" class="rn-size" style="width: 88px">
                  <a-option v-for="n in COVER_SIZES" :key="n" :value="n">{{ n }}px</a-option>
                </a-select>
                <button type="button" class="rn-btn" title="删除文本" @click="removeSel">✕</button>
              </div>
            </div>
            <p v-else class="pcs-hint">点击「插入文本」或在封面上双击，即可添加可编辑文字。</p>
          </aside>
        </div>
        <footer class="pcs-foot">
          <div v-if="pickTpl" class="pcs-tpls">
            <button
              v-for="t in COVER_TEMPLATES"
              :key="t.id"
              type="button"
              class="pe-cover"
              :class="[`theme-${t.id}`, { on: local.template === t.id }]"
              @click="setTpl(t.id)"
            >
              <span class="mini-kicker">{{ t.name }}</span>
            </button>
          </div>
          <button type="button" class="btn" @click="pickTpl = !pickTpl">换一个模板</button>
          <button type="button" class="btn primary" :disabled="!canEdit" @click="save">保存</button>
        </footer>
      </div>
    </div>
    <ColorPop
      :show="colorPick.show"
      :left="colorPick.left"
      :top="colorPick.top"
      :origin="colorPick.origin"
      @update:show="colorPick.show = $event"
      @pick="applyColor"
    />
  </Teleport>
</template>
