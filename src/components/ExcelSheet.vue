<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import ExcelJS from 'exceljs'
import { bookToUniver, colLetter, paintWorkbookThumb, univerToBook, xlsxToUniver } from '../utils/workbook'

const props = defineProps({
  readonly: { type: Boolean, default: false },
})

const rootRef = ref(null)
const fileRef = ref(null)
const book = ref(null)
const sheetIdx = ref(0)
const rev = ref(0)
const rows = ref(40)
const cols = ref(12)
const sel = ref({ r0: 0, c0: 0, r1: 0, c1: 0 })
const editing = ref(null)
const draft = ref('')
const editEl = ref(null)
const dragging = ref(false)
const palette = ['#FFFFFF', '#000000', '#F5F6F8', '#E8F3FF', '#FFF7E8', '#F6FFED', '#FFF1F0', '#F9F0FF', '#F5222D', '#FA8C16', '#FADB14', '#52C41A', '#1890FF', '#722ED1']

const sheets = computed(() => (rev.value, book.value?.worksheets || []))
const ws = computed(() => sheets.value[sheetIdx.value] || sheets.value[0] || null)

const mergeMap = computed(() => {
  const map = new Map()
  if (!ws.value) return map
  ;(ws.value.model?.merges || []).forEach((ref) => {
    const [a, b] = String(ref).split(':')
    const p1 = a1(a)
    const p2 = a1(b || a)
    const r0 = Math.min(p1.r, p2.r)
    const c0 = Math.min(p1.c, p2.c)
    const r1 = Math.max(p1.r, p2.r)
    const c1 = Math.max(p1.c, p2.c)
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        map.set(`${r}:${c}`, {
          master: r === r0 && c === c0,
          rowspan: r1 - r0 + 1,
          colspan: c1 - c0 + 1,
        })
      }
    }
  })
  return map
})

const grid = computed(() => {
  rev.value
  const sheet = ws.value
  const out = []
  if (!sheet) return out
  for (let r = 0; r < rows.value; r++) {
    const line = []
    for (let c = 0; c < cols.value; c++) {
      const mg = mergeMap.value.get(`${r}:${c}`)
      if (mg && !mg.master) {
        line.push({ skip: true })
        continue
      }
      const cell = sheet.getCell(r + 1, c + 1)
      line.push({
        skip: false,
        text: displayOf(cell),
        style: cssOf(cell),
        rowspan: mg?.rowspan || 1,
        colspan: mg?.colspan || 1,
      })
    }
    out.push(line)
  }
  return out
})

const selBox = computed(() => {
  const r0 = Math.min(sel.value.r0, sel.value.r1)
  const c0 = Math.min(sel.value.c0, sel.value.c1)
  const r1 = Math.max(sel.value.r0, sel.value.r1)
  const c1 = Math.max(sel.value.c0, sel.value.c1)
  return { r0, c0, r1, c1 }
})

function a1(addr) {
  const m = String(addr).toUpperCase().match(/^([A-Z]+)(\d+)$/)
  if (!m) return { r: 0, c: 0 }
  let c = 0
  for (let i = 0; i < m[1].length; i++) c = c * 26 + (m[1].charCodeAt(i) - 64)
  return { r: Number(m[2]) - 1, c: c - 1 }
}

function displayOf(cell) {
  const v = cell?.value
  if (v == null || v === '') return ''
  if (typeof v === 'number') return String(v)
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE'
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  if (typeof v === 'object') {
    if (v.richText) return v.richText.map((t) => t.text || '').join('')
    if (v.result != null) return String(v.result)
    if (v.text != null) return String(v.text)
    if (v.formula != null) return `=${v.formula}`
  }
  return String(v)
}

function hexOf(c) {
  if (!c) return ''
  const raw = c.argb || c.rgb || (typeof c === 'string' ? c : '')
  if (!raw) return ''
  const s = String(raw).replace('#', '')
  return s.length >= 6 ? `#${s.slice(-6)}` : ''
}

function cssOf(cell) {
  const bg = hexOf(cell?.fill?.fgColor)
  const color = hexOf(cell?.font?.color)
  const align = cell?.alignment?.horizontal || 'left'
  return {
    background: bg || '#fff',
    color: color || '#1f2329',
    fontWeight: cell?.font?.bold ? 700 : 400,
    textAlign: align,
  }
}

function touch() {
  rev.value += 1
}

function ensureBook() {
  if (book.value) return book.value
  const next = new ExcelJS.Workbook()
  next.addWorksheet('数据')
  book.value = next
  return next
}

function fitSize(target) {
  const sheet = target || ws.value
  let maxR = 8
  let maxC = 6
  sheet?.eachRow({ includeEmpty: false }, (row, r) => {
    maxR = Math.max(maxR, r)
    row.eachCell({ includeEmpty: false }, (_, c) => { maxC = Math.max(maxC, c) })
  })
  rows.value = Math.max(40, maxR + 12)
  cols.value = Math.max(12, maxC + 4)
}

function load(wb) {
  book.value = univerToBook(wb)
  sheetIdx.value = 0
  fitSize(book.value.worksheets[0])
  sel.value = { r0: 0, c0: 0, r1: 0, c1: 0 }
  editing.value = null
  touch()
}

function snapshot() {
  return bookToUniver(ensureBook())
}

function captureThumb() {
  return paintWorkbookThumb(snapshot())
}

function getActiveSheetName() {
  return ws.value?.name || '数据'
}

function getSelection() {
  const b = selBox.value
  if (b.r0 === b.r1 && b.c0 === b.c1) return null
  return { startRow: b.r0, startColumn: b.c0, endRow: b.r1, endColumn: b.c1 }
}

function addSheet(name) {
  const next = ensureBook().addWorksheet(name)
  sheetIdx.value = book.value.worksheets.length - 1
  fitSize(next)
  touch()
  return next
}

function setActiveSheet(name) {
  const i = sheets.value.findIndex((s) => s.name === name)
  if (i >= 0) {
    sheetIdx.value = i
    fitSize(sheets.value[i])
    touch()
  }
}

function writeBlock(name, startRow, startCol, matrix, headerRows = 0) {
  if (name) setActiveSheet(name)
  const sheet = ws.value
  if (!sheet || !matrix?.length) return false
  matrix.forEach((row, ri) => {
    row.forEach((v, ci) => {
      const cell = sheet.getCell(startRow + ri + 1, startCol + ci + 1)
      cell.value = v === '' || v == null ? null : v
      if (ri < headerRows) {
        cell.font = { bold: true }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F3FF' } }
      }
    })
  })
  fitSize(sheet)
  touch()
  return true
}

function isSel(r, c) {
  const b = selBox.value
  return r >= b.r0 && r <= b.r1 && c >= b.c0 && c <= b.c1
}

function pick(r, c, ev) {
  if (props.readonly) return
  if (ev?.shiftKey || dragging.value) {
    sel.value = { ...sel.value, r1: r, c1: c }
  } else {
    sel.value = { r0: r, c0: c, r1: r, c1: c }
  }
}

function startDrag(r, c, ev) {
  if (props.readonly || ev.button !== 0) return
  dragging.value = true
  pick(r, c, ev)
}

function moveDrag(r, c) {
  if (!dragging.value) return
  sel.value = { ...sel.value, r1: r, c1: c }
}

function endDrag() {
  dragging.value = false
}

function startEdit(r, c) {
  if (props.readonly) return
  const sheet = ws.value
  if (!sheet) return
  editing.value = { r, c }
  draft.value = displayOf(sheet.getCell(r + 1, c + 1))
  nextTick(() => editEl.value?.focus())
}

function commitEdit() {
  if (!editing.value || !ws.value) return
  const { r, c } = editing.value
  const cell = ws.value.getCell(r + 1, c + 1)
  const text = draft.value
  if (text === '') cell.value = null
  else if (/^-?\d+(\.\d+)?$/.test(text)) cell.value = Number(text)
  else if (text.startsWith('=')) cell.value = { formula: text.slice(1) }
  else cell.value = text
  editing.value = null
  touch()
}

function cancelEdit() {
  editing.value = null
}

function clearSel() {
  if (props.readonly || !ws.value) return
  const b = selBox.value
  for (let r = b.r0; r <= b.r1; r++) {
    for (let c = b.c0; c <= b.c1; c++) {
      ws.value.getCell(r + 1, c + 1).value = null
    }
  }
  touch()
}

function eachSel(fn) {
  if (!ws.value) return
  const b = selBox.value
  for (let r = b.r0; r <= b.r1; r++) {
    for (let c = b.c0; c <= b.c1; c++) fn(ws.value.getCell(r + 1, c + 1))
  }
}

function toggleBold() {
  if (props.readonly) return
  eachSel((cell) => {
    cell.font = { ...(cell.font || {}), bold: !cell.font?.bold }
  })
  touch()
}

function setFill(hex) {
  if (props.readonly) return
  eachSel((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${hex.replace('#', '')}` } }
  })
  touch()
}

function setColor(hex) {
  if (props.readonly) return
  eachSel((cell) => {
    cell.font = { ...(cell.font || {}), color: { argb: `FF${hex.replace('#', '')}` } }
  })
  touch()
}

function setAlign(h) {
  if (props.readonly) return
  eachSel((cell) => {
    cell.alignment = { ...(cell.alignment || {}), horizontal: h, vertical: 'middle' }
  })
  touch()
}

function mergeSel() {
  if (props.readonly || !ws.value) return
  const b = selBox.value
  if (b.r0 === b.r1 && b.c0 === b.c1) return
  try {
    ws.value.mergeCells(b.r0 + 1, b.c0 + 1, b.r1 + 1, b.c1 + 1)
  } catch { /* */ }
  touch()
}

function addBlankSheet() {
  if (props.readonly) return
  let n = sheets.value.length + 1
  let name = `Sheet${n}`
  while (sheets.value.some((s) => s.name === name)) {
    n += 1
    name = `Sheet${n}`
  }
  addSheet(name)
}

function switchSheet(i) {
  sheetIdx.value = i
  fitSize(sheets.value[i])
  sel.value = { r0: 0, c0: 0, r1: 0, c1: 0 }
  touch()
}

async function onImport(ev) {
  const file = ev.target.files?.[0]
  ev.target.value = ''
  if (!file) return
  const buf = await file.arrayBuffer()
  const snap = await xlsxToUniver(buf, file.name.replace(/\.xlsx?$/i, ''))
  load(snap)
}

function onKey(e) {
  if (props.readonly) return
  if (editing.value) {
    if (e.key === 'Enter') { e.preventDefault(); commitEdit(); move(1, 0) }
    else if (e.key === 'Escape') cancelEdit()
    else if (e.key === 'Tab') { e.preventDefault(); commitEdit(); move(0, e.shiftKey ? -1 : 1) }
    return
  }
  const k = e.key
  if (k === 'ArrowDown') { e.preventDefault(); move(1, 0, e.shiftKey) }
  else if (k === 'ArrowUp') { e.preventDefault(); move(-1, 0, e.shiftKey) }
  else if (k === 'ArrowLeft') { e.preventDefault(); move(0, -1, e.shiftKey) }
  else if (k === 'ArrowRight') { e.preventDefault(); move(0, 1, e.shiftKey) }
  else if (k === 'Enter') { e.preventDefault(); startEdit(sel.value.r0, sel.value.c0) }
  else if (k === 'Tab') { e.preventDefault(); move(0, e.shiftKey ? -1 : 1) }
  else if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); clearSel() }
  else if (e.ctrlKey && k.toLowerCase() === 'b') { e.preventDefault(); toggleBold() }
  else if (k.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
    startEdit(sel.value.r0, sel.value.c0)
    draft.value = k
  }
}

function move(dr, dc, extend) {
  const r = Math.max(0, Math.min(rows.value - 1, (extend ? sel.value.r1 : sel.value.r0) + dr))
  const c = Math.max(0, Math.min(cols.value - 1, (extend ? sel.value.c1 : sel.value.c0) + dc))
  if (extend) sel.value = { ...sel.value, r1: r, c1: c }
  else sel.value = { r0: r, c0: c, r1: r, c1: c }
}

watch(() => props.readonly, () => { editing.value = null })

onBeforeUnmount(() => {
  window.removeEventListener('mouseup', endDrag)
})
window.addEventListener('mouseup', endDrag)

if (!book.value) load(null)

defineExpose({
  load,
  snapshot,
  captureThumb,
  getActiveSheetName,
  getSelection,
  addSheet,
  setActiveSheet,
  writeBlock,
})
</script>

<template>
  <div ref="rootRef" class="xg" tabindex="0" @keydown="onKey">
    <div v-if="!readonly" class="xg-bar">
      <button type="button" class="xg-btn" @click="fileRef?.click()">导入 Excel</button>
      <input ref="fileRef" type="file" accept=".xlsx,.xls" hidden @change="onImport">
      <span class="xg-split"></span>
      <button type="button" class="xg-btn" :class="{ on: false }" title="加粗" @click="toggleBold"><b>B</b></button>
      <label class="xg-color" title="填充色">
        <span>填充</span>
        <input type="color" value="#E8F3FF" @input="setFill($event.target.value)">
      </label>
      <label class="xg-color" title="字体颜色">
        <span>字体</span>
        <input type="color" value="#1F2329" @input="setColor($event.target.value)">
      </label>
      <button type="button" class="xg-btn" @click="setAlign('left')">左齐</button>
      <button type="button" class="xg-btn" @click="setAlign('center')">居中</button>
      <button type="button" class="xg-btn" @click="setAlign('right')">右齐</button>
      <button type="button" class="xg-btn" @click="mergeSel">合并</button>
      <span class="xg-split"></span>
      <slot name="tools"></slot>
      <div class="xg-swatch">
        <button v-for="p in palette" :key="p" type="button" :style="{ background: p }" @click="setFill(p)"></button>
      </div>
    </div>
    <div class="xg-scroll">
      <table class="xg-table">
        <thead>
          <tr>
            <th class="xg-gutter"></th>
            <th v-for="c in cols" :key="'c'+c" class="xg-colh" :class="{ on: c - 1 >= selBox.c0 && c - 1 <= selBox.c1 }">{{ colLetter(c - 1) }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, r) in grid" :key="'r'+r">
            <th class="xg-rowh" :class="{ on: r >= selBox.r0 && r <= selBox.r1 }">{{ r + 1 }}</th>
            <template v-for="(cell, c) in row" :key="'c'+r+'-'+c">
            <td
              v-if="!cell.skip"
              :rowspan="cell.rowspan"
              :colspan="cell.colspan"
              :style="cell.style"
              :class="{ sel: isSel(r, c), active: sel.r0 === r && sel.c0 === c }"
              @mousedown.prevent="startDrag(r, c, $event)"
              @mouseenter="moveDrag(r, c)"
              @dblclick="startEdit(r, c)"
            >
              <input
                v-if="editing && editing.r === r && editing.c === c"
                ref="editEl"
                v-model="draft"
                class="xg-edit"
                @blur="commitEdit"
                @keydown.enter.prevent="commitEdit"
                @keydown.esc.stop="cancelEdit"
                @mousedown.stop
              >
              <span v-else>{{ cell.text }}</span>
            </td>
            </template>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="xg-tabs">
      <button
        v-for="(s, i) in sheets"
        :key="s.id || i"
        type="button"
        class="xg-tab"
        :class="{ on: i === sheetIdx }"
        @click="switchSheet(i)"
      >{{ s.name }}</button>
      <button v-if="!readonly" type="button" class="xg-tab add" @click="addBlankSheet">+</button>
    </div>
  </div>
</template>
