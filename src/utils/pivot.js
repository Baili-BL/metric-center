export const PIVOT_AGGS = [
  { id: 'sum', name: '求和' },
  { id: 'count', name: '计数' },
  { id: 'avg', name: '平均值' },
  { id: 'max', name: '最大值' },
  { id: 'min', name: '最小值' },
]

export const PIVOT_SHOWS = [
  { id: 'none', name: '无计算' },
  { id: 'pctCol', name: '占列的百分比' },
  { id: 'pctRow', name: '占行的百分比' },
  { id: 'pctTotal', name: '占总计的百分比' },
  { id: 'index', name: '指数' },
]

export const PIVOT_COND = {
  text: [['contains', '包含'], ['notContains', '不包含'], ['eq', '等于'], ['ne', '不等于'], ['starts', '开头是'], ['ends', '结尾是'], ['empty', '为空'], ['notEmpty', '不为空']],
  num: [['gt', '大于'], ['gte', '大于或等于'], ['lt', '小于'], ['lte', '小于或等于'], ['eq', '等于'], ['ne', '不等于'], ['between', '介于'], ['empty', '为空'], ['notEmpty', '不为空']],
  date: [['before', '早于'], ['after', '晚于'], ['between', '介于'], ['empty', '为空'], ['notEmpty', '不为空']],
}

const BANNED_FNS = ['RAND', 'NOW', 'TODAY', 'VLOOKUP', 'IMPORTRANGE']

export function emptyPivot() {
  return {
    open: false,
    headers: [],
    rows: [],
    range: null,
    sourceName: '',
    filters: [],
    rowsF: [],
    cols: [],
    values: [],
    calcFields: [],
    showRowTotal: true,
    showColTotal: true,
    showSubTotal: true,
    repeatLabels: false,
    fieldOpts: {},
    collapsed: {},
    out: null,
    outName: '',
  }
}

export function isCalcId(idx) {
  return typeof idx === 'string' && idx.startsWith('cf')
}

export function colName(n) {
  let s = ''
  let x = n + 1
  while (x > 0) {
    x -= 1
    s = String.fromCharCode(65 + (x % 26)) + s
    x = Math.floor(x / 26)
  }
  return s
}

export function cellPlain(cell) {
  if (!cell) return { kind: 'empty' }
  let v = cell.v
  if (v && typeof v === 'object' && v.v != null) v = v.v
  if (v == null && cell.p?.body?.dataStream) {
    v = String(cell.p.body.dataStream).replace(/\r?\n/g, '').replace(/\u0000/g, '')
  }
  if (v == null || v === '') return { kind: 'empty' }
  if (cell.t === 2 || cell.t === 'n' || typeof v === 'number') {
    const n = Number(v)
    if (Number.isFinite(n)) return { kind: 'n', v: n }
  }
  return { kind: 's', v: String(v) }
}

export function sheetUsedRange(sheet) {
  const cellData = sheet?.cellData || {}
  let maxR = -1
  let maxC = -1
  Object.keys(cellData).forEach((rk) => {
    const r = Number(rk)
    if (!Number.isFinite(r)) return
    Object.keys(cellData[r] || {}).forEach((ck) => {
      const cell = cellData[r][ck]
      const p = cellPlain(cell)
      if (p.kind === 'empty' && !(cell && cell.s)) return
      maxR = Math.max(maxR, r)
      maxC = Math.max(maxC, Number(ck) || 0)
    })
  })
  if (maxR < 0) return null
  return { startRow: 0, startColumn: 0, endRow: maxR, endColumn: maxC }
}

export function extractPivotSource(sheet, range) {
  const cellData = sheet?.cellData || {}
  const headers = []
  for (let c = range.startColumn; c <= range.endColumn; c++) {
    const cell = cellData[range.startRow]?.[c]
    const p = cellPlain(cell)
    headers.push(p.kind === 'empty' ? `列${colName(c)}` : String(p.v))
  }
  const rows = []
  for (let r = range.startRow + 1; r <= range.endRow; r++) {
    const row = []
    let empty = true
    for (let c = range.startColumn; c <= range.endColumn; c++) {
      const p = cellPlain(cellData[r]?.[c])
      const v = p.kind === 'empty' ? '' : p.v
      if (v !== '') empty = false
      row.push(v)
    }
    if (!empty) rows.push(row)
  }
  return { headers, rows }
}

export function parseA1Range(text) {
  const raw = String(text || '').trim().replace(/^.*!/, '').replace(/\$/g, '')
  const m = raw.toUpperCase().match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/)
  if (!m) return null
  const col = (s) => {
    let n = 0
    for (let i = 0; i < s.length; i++) n = n * 26 + (s.charCodeAt(i) - 64)
    return n - 1
  }
  const a = { startRow: Number(m[2]) - 1, startColumn: col(m[1]), endRow: Number(m[4]) - 1, endColumn: col(m[3]) }
  if (a.endRow < a.startRow) { const t = a.startRow; a.startRow = a.endRow; a.endRow = t }
  if (a.endColumn < a.startColumn) { const t = a.startColumn; a.startColumn = a.endColumn; a.endColumn = t }
  return a
}

export function parseA1Cell(text) {
  const raw = String(text || '').trim().replace(/^.*!/, '').replace(/\$/g, '')
  const m = raw.toUpperCase().match(/^([A-Z]+)(\d+)$/)
  if (!m) return null
  let n = 0
  const s = m[1]
  for (let i = 0; i < s.length; i++) n = n * 26 + (s.charCodeAt(i) - 64)
  return { row: Number(m[2]) - 1, col: n - 1 }
}

export function absRangeRef(name, range) {
  return `${name}!$${colName(range.startColumn)}$${range.startRow + 1}:$${colName(range.endColumn)}$${range.endRow + 1}`
}

export function absCellRef(name, row, col) {
  return `${name}!$${colName(col)}$${row + 1}`
}

export function listWorkbookSheets(wb) {
  if (!wb?.sheets) return []
  const ids = wb.sheetOrder?.length ? wb.sheetOrder.slice() : Object.keys(wb.sheets)
  const seen = {}
  return ids.map((id, i) => wb.sheets[id]).filter(Boolean).map((sh, i) => {
    let name = String(sh.name || `Sheet${i + 1}`).slice(0, 31) || `Sheet${i + 1}`
    const base = name
    let n = 2
    while (seen[name]) { name = `${base.slice(0, 28)}_${n}`; n++ }
    seen[name] = true
    return { name, sheet: sh }
  })
}

export function fieldUsed(state, idx) {
  if (state.rowsF.includes(idx) || state.cols.includes(idx)) return true
  if (state.filters.some((f) => f.idx === idx)) return true
  if (state.values.some((v) => v.idx === idx)) return true
  return false
}

export function headerName(state, idx) {
  if (isCalcId(idx)) return state.calcFields?.find((f) => f.id === idx)?.name || '计算字段'
  return state.headers[idx] || ''
}

export function uniqueFieldValues(stateOrRows, idx) {
  const state = stateOrRows?.headers && stateOrRows?.rows ? stateOrRows : null
  const rows = state ? state.rows : (stateOrRows || [])
  const seen = {}
  const list = []
  rows.forEach((row) => {
    const v = state ? rowValue(state, row, idx) : (row[idx] == null ? '' : row[idx])
    const k = String(v ?? '')
    if (!seen[k]) { seen[k] = true; list.push(v ?? '') }
  })
  return list
}

export function fieldIsNumber(rows, idx) {
  let n = 0
  let t = 0
  rows.forEach((row) => {
    if (row[idx] === '' || row[idx] == null) return
    t++
    if (typeof row[idx] === 'number') n++
  })
  return t > 0 && n * 2 >= t
}

export function removeFieldFrom(state, idx, zone) {
  if (zone === 'rows') state.rowsF = state.rowsF.filter((i) => i !== idx)
  else if (zone === 'cols') state.cols = state.cols.filter((i) => i !== idx)
  else if (zone === 'filters') state.filters = state.filters.filter((f) => f.idx !== idx)
  else if (zone === 'values') state.values = state.values.filter((v) => v.idx !== idx)
  else removeField(state, idx)
}

export function removeField(state, idx) {
  state.rowsF = state.rowsF.filter((i) => i !== idx)
  state.cols = state.cols.filter((i) => i !== idx)
  state.filters = state.filters.filter((f) => f.idx !== idx)
  state.values = state.values.filter((v) => v.idx !== idx)
}

export function addFieldTo(state, idx, zone) {
  if (zone === 'filters') {
    removeField(state, idx)
    const selected = {}
    uniqueFieldValues(state, idx).forEach((v) => { selected[String(v)] = true })
    state.filters.push({ idx, selected, cond: null })
    return
  }
  if (zone === 'rows') {
    state.cols = state.cols.filter((i) => i !== idx)
    state.filters = state.filters.filter((f) => f.idx !== idx)
    if (!state.rowsF.includes(idx)) state.rowsF.push(idx)
    return
  }
  if (zone === 'cols') {
    state.rowsF = state.rowsF.filter((i) => i !== idx)
    state.filters = state.filters.filter((f) => f.idx !== idx)
    if (!state.cols.includes(idx)) state.cols.push(idx)
    return
  }
  if (zone === 'values') {
    state.filters = state.filters.filter((f) => f.idx !== idx)
    if (!state.values.some((v) => v.idx === idx)) {
      state.values.push({
        idx,
        agg: isCalcId(idx) || fieldIsNumber(state.rows, idx) ? 'sum' : 'count',
        show: 'none',
      })
    }
  }
}

export function guessZone(state, idx) {
  if (isCalcId(idx)) return 'values'
  return fieldIsNumber(state.rows, idx) ? 'values' : 'rows'
}

export function aggName(id) {
  return PIVOT_AGGS.find((a) => a.id === id)?.name || id
}

export function valueLabel(state, v) {
  if (v?.implicit) return '计数'
  if (isCalcId(v?.idx)) return headerName(state, v.idx)
  return `${aggName(v.agg)}项:${headerName(state, v.idx)}`
}

export function filterLabel(state, f) {
  const name = headerName(state, f.idx)
  const keys = Object.keys(f.selected || {})
  const on = keys.filter((k) => f.selected[k])
  const condOn = !!(f.cond && f.cond.op)
  if (condOn && (!keys.length || on.length === keys.length)) return `${name} (条件)`
  if (!keys.length || on.length === keys.length) return name
  if (!on.length) return `${name} (无)`
  if (on.length === 1) return `${name} (${on[0]})`
  return `${name} (${on.length} 项)`
}

function optOf(state, idx) {
  return state.fieldOpts?.[String(idx)] || {}
}

function passesSelected(value, selected) {
  if (!selected) return true
  const keys = Object.keys(selected)
  if (!keys.length) return true
  const on = keys.filter((k) => selected[k])
  if (on.length === keys.length) return true
  return !!selected[String(value ?? '')]
}

function parseDateValue(v) {
  if (v instanceof Date) return v.getTime()
  if (typeof v === 'number' && v > 30000 && v < 60000) return (v - 25569) * 86400000
  const s = String(v ?? '').trim()
  if (!s) return NaN
  const m = s.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/)
  if (!m) return NaN
  return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)).getTime()
}

function dayStart(v) {
  const t = parseDateValue(v)
  if (!Number.isFinite(t)) return NaN
  const d = new Date(t)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

export function matchCond(value, cond) {
  if (!cond?.op) return true
  const op = cond.op
  const empty = value == null || value === ''
  if (op === 'empty') return empty
  if (op === 'notEmpty') return !empty
  const kind = cond.kind || 'text'
  if (kind === 'num') {
    const n = Number(value)
    const a = Number(cond.v1)
    const b = Number(cond.v2)
    if (!Number.isFinite(n)) return false
    if (op === 'between') return n >= Math.min(a, b) && n <= Math.max(a, b)
    if (!Number.isFinite(a)) return false
    if (op === 'gt') return n > a
    if (op === 'gte') return n >= a
    if (op === 'lt') return n < a
    if (op === 'lte') return n <= a
    if (op === 'eq') return n === a
    if (op === 'ne') return n !== a
    return true
  }
  if (kind === 'date') {
    const t = parseDateValue(value)
    const a = dayStart(cond.v1)
    const b = dayStart(cond.v2)
    if (!Number.isFinite(t) || !Number.isFinite(a)) return false
    if (op === 'before') return t < a
    if (op === 'after') return t >= a + 86400000
    if (op === 'between') {
      if (!Number.isFinite(b)) return false
      const lo = Math.min(a, b)
      const hi = Math.max(a, b)
      return t >= lo && t < hi + 86400000
    }
    return true
  }
  const s = String(value ?? '').toLowerCase()
  const q = String(cond.v1 ?? '').toLowerCase()
  if (op === 'eq') return s === q
  if (op === 'ne') return s !== q
  if (op === 'contains') return q ? s.includes(q) : true
  if (op === 'notContains') return q ? !s.includes(q) : true
  if (op === 'starts') return s.startsWith(q)
  if (op === 'ends') return s.endsWith(q)
  return true
}

function rowPasses(state, row) {
  const rules = state.filters.slice()
  ;[...state.rowsF, ...state.cols].forEach((idx) => {
    const opt = optOf(state, idx)
    if (opt.selected || opt.cond) rules.push({ idx, selected: opt.selected, cond: opt.cond })
  })
  return rules.every((f) => {
    const v = rowValue(state, row, f.idx)
    return passesSelected(v, f.selected) && matchCond(v, f.cond)
  })
}

const FN_ALIAS = { 求和: 'SUM', 计数: 'COUNT', 平均值: 'AVERAGE', 最大值: 'MAX', 最小值: 'MIN', 四舍五入: 'ROUND', 如果: 'IF' }

function tokenizeFormula(src) {
  const s = String(src || '').trim().replace(/^=/, '').replace(/＝/g, '=').replace(/（/g, '(').replace(/）/g, ')').replace(/，/g, ',')
  const tokens = []
  let i = 0
  while (i < s.length) {
    const c = s[i]
    if (/\s/.test(c)) { i++; continue }
    if (c === "'") {
      let j = i + 1
      let name = ''
      while (j < s.length) {
        if (s[j] === "'" && s[j + 1] === "'") { name += "'"; j += 2; continue }
        if (s[j] === "'") break
        name += s[j++]
      }
      if (s[j] !== "'") throw new Error('字段名缺少右引号')
      tokens.push({ t: 'field', v: name })
      i = j + 1
      continue
    }
    if (/[0-9.]/.test(c)) {
      let j = i
      while (j < s.length && /[0-9.]/.test(s[j])) j++
      const n = Number(s.slice(i, j))
      if (!Number.isFinite(n)) throw new Error('数字无效')
      tokens.push({ t: 'num', v: n })
      i = j
      continue
    }
    if (/[A-Za-z_\u4e00-\u9fff]/.test(c)) {
      let j = i
      while (j < s.length && /[A-Za-z0-9_\u4e00-\u9fff]/.test(s[j])) j++
      tokens.push({ t: 'id', v: s.slice(i, j) })
      i = j
      continue
    }
    const two = s.slice(i, i + 2)
    if (['>=', '<=', '<>', '!='].includes(two)) {
      tokens.push({ t: 'op', v: two === '!=' ? '<>' : two })
      i += 2
      continue
    }
    if ('+-*/^(),=<>'.includes(c)) { tokens.push({ t: 'op', v: c }); i++; continue }
    throw new Error(`无法识别「${c}」`)
  }
  return tokens
}

function fnName(raw) {
  const up = String(raw || '').toUpperCase()
  return FN_ALIAS[raw] || up
}

function fieldStat(ctx, name, how) {
  const idx = ctx.headers.indexOf(name)
  if (idx < 0) throw new Error(`找不到字段「${name}」`)
  const list = ctx.rows.map((row) => row[idx])
  if (how === 'raw') return list.length ? list[0] : ''
  const nums = numsOf(list)
  if (how === 'count') return list.filter((v) => v !== '' && v != null && Number.isFinite(Number(v))).length
  if (how === 'counta') return list.filter((v) => v !== '' && v != null).length
  if (how === 'avg') return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : ''
  if (how === 'max') return nums.length ? Math.max(...nums) : ''
  if (how === 'min') return nums.length ? Math.min(...nums) : ''
  return nums.reduce((a, b) => a + b, 0)
}

function asNum(v) {
  if (typeof v === 'boolean') return v ? 1 : 0
  if (v == null || v === '') return 0
  const n = Number(v)
  if (!Number.isFinite(n)) throw new Error('公式里有无法计算的内容')
  return n
}

function cmpVal(a, b, op) {
  const na = Number(a)
  const nb = Number(b)
  const bothNum = a !== '' && b !== '' && Number.isFinite(na) && Number.isFinite(nb)
  const c = bothNum ? na - nb : String(a ?? '').localeCompare(String(b ?? ''), 'zh')
  if (op === '>') return c > 0
  if (op === '<') return c < 0
  if (op === '>=') return c >= 0
  if (op === '<=') return c <= 0
  if (op === '=') return c === 0
  return c !== 0
}

function evalFormula(formula, ctx) {
  const banned = BANNED_FNS.find((name) => new RegExp(`\\b${name}\\s*\\(`, 'i').test(String(formula || '')))
  if (banned) throw new Error(`不支持函数 ${banned}`)
  const tokens = tokenizeFormula(formula)
  let i = 0
  const peek = () => tokens[i]
  const next = () => tokens[i++]
  const parseArgs = (kindAt) => {
    if (peek()?.v !== '(') throw new Error('函数缺少括号')
    next()
    const args = []
    if (peek()?.v === ')') { next(); return args }
    let n = 0
    while (true) {
      args.push(parseArg(kindAt ? kindAt(n) : null))
      n++
      if (peek()?.v === ',') { next(); continue }
      if (peek()?.v === ')') { next(); break }
      throw new Error('函数参数不正确')
    }
    return args
  }
  const parseArg = (kind) => {
    if (kind && peek()?.t === 'field') return fieldStat(ctx, next().v, kind)
    return parseCmp()
  }
  const parseCmp = () => {
    const left = parseAdd()
    const op = peek()
    if (op?.t === 'op' && ['>', '<', '>=', '<=', '=', '<>'].includes(op.v)) {
      next()
      return cmpVal(left, parseAdd(), op.v)
    }
    return left
  }
  const parseAdd = () => {
    let left = parseMul()
    while (peek()?.t === 'op' && (peek().v === '+' || peek().v === '-')) {
      const op = next().v
      const right = parseMul()
      left = op === '+' ? asNum(left) + asNum(right) : asNum(left) - asNum(right)
    }
    return left
  }
  const parseMul = () => {
    let left = parseUnary()
    while (peek()?.t === 'op' && (peek().v === '*' || peek().v === '/' || peek().v === '^')) {
      const op = next().v
      const right = parseUnary()
      if (op === '*') left = asNum(left) * asNum(right)
      else if (op === '^') left = asNum(left) ** asNum(right)
      else {
        const b = asNum(right)
        left = b ? asNum(left) / b : ''
      }
    }
    return left
  }
  const parseUnary = () => {
    if (peek()?.t === 'op' && peek().v === '-') { next(); return -asNum(parseUnary()) }
    return parsePrimary()
  }
  const parsePrimary = () => {
    const tok = peek()
    if (!tok) throw new Error('公式没有写完')
    if (tok.t === 'num') { next(); return tok.v }
    if (tok.t === 'field') { next(); return fieldStat(ctx, tok.v, ctx.mode === 'row' ? 'raw' : 'sum') }
    if (tok.t === 'op' && tok.v === '(') {
      next()
      const v = parseCmp()
      if (peek()?.v !== ')') throw new Error('缺少右括号')
      next()
      return v
    }
    if (tok.t === 'id') {
      const name = fnName(next().v)
      if (BANNED_FNS.includes(name)) throw new Error(`不支持函数 ${name}`)
      const kind = { SUM: 'sum', COUNT: 'count', COUNTA: 'counta', AVERAGE: 'avg', MAX: 'max', MIN: 'min' }[name]
      const args = parseArgs(kind ? () => kind : null)
      if (name === 'SUM') return args.reduce((s, v) => asNum(s) + asNum(v), 0)
      if (name === 'COUNT' || name === 'COUNTA' || name === 'AVERAGE' || name === 'MAX' || name === 'MIN') return args.length === 1 ? args[0] : args.reduce((s, v) => asNum(s) + asNum(v), 0)
      if (name === 'ABS') return Math.abs(asNum(args[0]))
      if (name === 'INT') return Math.floor(asNum(args[0]))
      if (name === 'ROUND') return Number(asNum(args[0]).toFixed(Math.max(0, asNum(args[1] || 0))))
      if (name === 'IF') return args[0] ? args[1] : args[2]
      if (name === 'AND') return args.every(Boolean)
      if (name === 'OR') return args.some(Boolean)
      if (name === 'YEAR' || name === 'MONTH' || name === 'DAY' || name === 'HOUR' || name === 'WEEKDAY') {
        const t = parseDateValue(args[0])
        if (!Number.isFinite(t)) return ''
        const d = new Date(t)
        if (name === 'YEAR') return d.getFullYear()
        if (name === 'MONTH') return d.getMonth() + 1
        if (name === 'DAY') return d.getDate()
        if (name === 'HOUR') return d.getHours()
        return d.getDay() + 1
      }
      throw new Error(`不支持函数 ${name}`)
    }
    throw new Error('公式无法解析')
  }
  if (!tokens.length) throw new Error('请输入公式')
  const value = parseCmp()
  if (peek()) throw new Error('公式没有写完')
  return tidy(value)
}

export function validateCalcFormula(state, formula, mode) {
  try {
    evalFormula(formula, {
      mode: mode === 'custom' ? 'custom' : 'sum',
      rows: state.rows || [],
      headers: state.headers || [],
    })
    return ''
  } catch (e) {
    return e.message || '公式错误'
  }
}

function rowValue(state, row, idx) {
  if (!isCalcId(idx)) return row[idx] == null ? '' : row[idx]
  const cf = (state.calcFields || []).find((f) => f.id === idx)
  if (!cf) return ''
  try {
    const v = evalFormula(cf.formula, { mode: 'row', rows: [row], headers: state.headers })
    return v == null || v === '' ? '' : v
  } catch {
    return ''
  }
}

function numsOf(list) {
  return list.map((v) => (v === '' || v == null ? NaN : Number(v))).filter((n) => Number.isFinite(n))
}

function tidy(v) {
  if (typeof v !== 'number' || !Number.isFinite(v)) return v == null ? '' : v
  return Math.round(v * 1e6) / 1e6
}

function cmpSelf(a, b) {
  const as = String(a ?? '')
  const bs = String(b ?? '')
  const da = /^\d{4}[\/\-.]/.test(as) ? parseDateValue(a) : NaN
  const db = /^\d{4}[\/\-.]/.test(bs) ? parseDateValue(b) : NaN
  if (Number.isFinite(da) && Number.isFinite(db)) return da - db
  const na = typeof a === 'number' ? a : (/^-?\d+(\.\d+)?$/.test(as) ? Number(as) : NaN)
  const nb = typeof b === 'number' ? b : (/^-?\d+(\.\d+)?$/.test(bs) ? Number(bs) : NaN)
  if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb
  return as.localeCompare(bs, 'zh')
}

function rowsMatching(state, rows, idxs, parts) {
  if (!parts) return rows
  return rows.filter((row) => parts.every((part, i) => String(rowValue(state, row, idxs[i]) ?? '') === String(part ?? '')))
}

function aggOne(state, rows, val) {
  if (!val || val.implicit) return rows.length
  if (isCalcId(val.idx)) {
    const cf = (state.calcFields || []).find((f) => f.id === val.idx)
    if (!cf) return ''
    try {
      return tidy(evalFormula(cf.formula, {
        mode: cf.mode === 'custom' ? 'custom' : 'sum',
        rows,
        headers: state.headers,
      }))
    } catch {
      return ''
    }
  }
  return aggValues(rows.map((row) => row[val.idx]), val.agg)
}

function groupMeasure(state, rows, idxs, prefix, colIdxs, colKey, val) {
  let hit = rowsMatching(state, rows, idxs, prefix)
  if (colKey) {
    const colParts = String(colKey).split('\x1f')
    hit = rowsMatching(state, hit, colIdxs, colParts)
  }
  const n = aggOne(state, hit, val)
  return Number.isFinite(Number(n)) ? Number(n) : 0
}

function sortCombos(combos, idxs, state, rows, vals, colIdxs) {
  return combos.slice().sort((a, b) => {
    for (let level = 0; level < idxs.length; level++) {
      if (String(a[level]) === String(b[level])) continue
      const opt = optOf(state, idxs[level])
      const dir = opt.sortDir === 'desc' ? -1 : 1
      let c = 0
      if (opt.sortBy === 'value' && vals.length) {
        const val = vals[Math.min(opt.sortVal || 0, vals.length - 1)]
        c = groupMeasure(state, rows, idxs, a.slice(0, level + 1), colIdxs, opt.sortCol || '', val)
          - groupMeasure(state, rows, idxs, b.slice(0, level + 1), colIdxs, opt.sortCol || '', val)
      } else c = cmpSelf(a[level], b[level])
      if (c) return c * dir
    }
    return 0
  })
}

function uniqueCombos(state, rows, idxs) {
  if (!idxs.length) return [[]]
  const seen = {}
  const list = []
  rows.forEach((row) => {
    const parts = idxs.map((i) => rowValue(state, row, i))
    const k = parts.map((p) => String(p ?? '')).join('\x1f')
    if (!seen[k]) { seen[k] = true; list.push(parts) }
  })
  return list
}

function round2(n) { return Math.round(n * 100) / 100 }

function aggValues(arr, agg) {
  if (agg === 'count') return arr.filter((v) => v !== '' && v != null).length
  const nums = arr.map(Number).filter((n) => Number.isFinite(n))
  if (!nums.length) return ''
  if (agg === 'avg') return round2(nums.reduce((a, b) => a + b, 0) / nums.length)
  if (agg === 'max') return Math.max(...nums)
  if (agg === 'min') return Math.min(...nums)
  return round2(nums.reduce((a, b) => a + b, 0))
}

function pctText(n) {
  return `${(Math.round(n * 10000) / 100).toFixed(2)}%`
}

function applyShow(matrix, layout, vals) {
  const raw = matrix.map((row) => row.slice())
  vals.forEach((val, vi) => {
    const show = val.show || 'none'
    if (!show || show === 'none') return
    const colIndexes = []
    layout.cols.forEach((col, ci) => {
      if (col.valIndex === vi) colIndexes.push(ci)
    })
    const body = []
    const dataRows = []
    let totalRow = -1
    layout.rows.forEach((row, ri) => {
      if (row.type === 'total') totalRow = ri
      if (row.type === 'data' || row.type === 'sub' || row.type === 'total') body.push(ri)
      if (row.type === 'data') dataRows.push(ri)
    })
    const valCols = colIndexes.filter((ci) => layout.cols[ci].type === 'val')
    const totalCols = colIndexes.filter((ci) => layout.cols[ci].type === 'total')
    const sumAt = (ri, cols) => cols.reduce((s, ci) => s + (Number(raw[ri][ci]) || 0), 0)
    const grand = totalRow >= 0
      ? sumAt(totalRow, totalCols.length ? totalCols : valCols)
      : dataRows.reduce((s, ri) => s + sumAt(ri, valCols), 0)
    const colDenom = (ci) => (totalRow >= 0 ? (Number(raw[totalRow][ci]) || 0) : dataRows.reduce((s, ri) => s + (Number(raw[ri][ci]) || 0), 0))
    const rowDenom = (ri) => sumAt(ri, totalCols.length ? totalCols : valCols)
    body.forEach((ri) => {
      colIndexes.forEach((ci) => {
        const cell = Number(raw[ri][ci])
        if (!Number.isFinite(cell)) return
        const cd = colDenom(ci)
        const rd = rowDenom(ri)
        let out = ''
        if (show === 'pctCol') out = cd ? cell / cd : ''
        else if (show === 'pctRow') out = rd ? cell / rd : ''
        else if (show === 'pctTotal') out = grand ? cell / grand : ''
        else if (show === 'index') out = rd && cd ? (cell * grand) / (rd * cd) : ''
        matrix[ri][ci] = out === '' ? '' : (show === 'index' ? Math.round(out * 100) / 100 : pctText(out))
      })
    })
  })
}

export function buildPivotMatrix(state) {
  const rows = (state.rows || []).filter((row) => rowPasses(state, row))
  const rowIdxs = state.rowsF.slice()
  const colIdxs = state.cols.slice()
  const vals = state.values.length ? state.values.slice() : [{ idx: -1, agg: 'count', implicit: true, show: 'none' }]
  if (!rowIdxs.length && !colIdxs.length && !state.values.length) {
    state._layout = null
    return []
  }
  let rowCombos = sortCombos(uniqueCombos(state, rows, rowIdxs), rowIdxs, state, rows, vals, colIdxs)
  const colCombos = sortCombos(uniqueCombos(state, rows, colIdxs), colIdxs, state, rows, vals, [])
  const showColTotal = state.showColTotal !== false && colIdxs.length > 0
  const showRowTotal = state.showRowTotal !== false && rowIdxs.length > 0
  const showSubTotal = state.showSubTotal !== false && rowIdxs.length > 1
  const twoHead = colIdxs.length > 0 && vals.length > 1
  const leftW = Math.max(rowIdxs.length, 1)
  const matrix = []
  const rowMeta = []
  const pushRow = (cells, meta) => { matrix.push(cells); rowMeta.push(meta) }
  const blankLabels = () => Array.from({ length: leftW }, () => '')
  const valueCells = (bucket) => {
    const cells = []
    colCombos.forEach((parts) => {
      const hit = rowsMatching(state, bucket, colIdxs, colIdxs.length ? parts : null)
      vals.forEach((v) => cells.push(aggOne(state, hit, v)))
    })
    if (showColTotal) vals.forEach((v) => cells.push(aggOne(state, bucket, v)))
    return cells
  }
  if (twoHead) {
    const top = blankLabels()
    top[0] = headerName(state, rowIdxs[0])
    colCombos.forEach((parts) => {
      const name = parts.map(String).join(' / ')
      vals.forEach((_, vi) => { top.push(vi === 0 ? name : '') })
    })
    if (showColTotal) vals.forEach((_, vi) => { top.push(vi === 0 ? '总计' : '') })
    pushRow(top, { type: 'head' })
    const sub = rowIdxs.length ? rowIdxs.map((idx) => headerName(state, idx)) : blankLabels()
    colCombos.forEach(() => { vals.forEach((v) => { sub.push(valueLabel(state, v)) }) })
    if (showColTotal) vals.forEach((v) => { sub.push(valueLabel(state, v)) })
    pushRow(sub, { type: 'head' })
  } else {
    const head = rowIdxs.length ? rowIdxs.map((idx) => headerName(state, idx)) : ['']
    if (colIdxs.length) {
      colCombos.forEach((parts) => {
        const name = parts.map(String).join(' / ')
        vals.forEach((v) => { head.push(vals.length === 1 ? name : `${name} ${valueLabel(state, v)}`) })
      })
    } else vals.forEach((v) => { head.push(valueLabel(state, v)) })
    if (showColTotal) vals.forEach((v) => { head.push(vals.length === 1 ? '总计' : `总计 ${valueLabel(state, v)}`) })
    pushRow(head, { type: 'head' })
  }
  const displayParts = (parts, prev, toggleLevel) => {
    const line = []
    for (let i = 0; i < leftW; i++) {
      let text = i < parts.length ? parts[i] : ''
      if (!state.repeatLabels && prev && i < prev.length && String(prev[i]) === String(parts[i]) && i !== toggleLevel) text = ''
      if (i === toggleLevel && toggleLevel >= 0) {
        const key = parts.slice(0, toggleLevel + 1).map(String).join('\x1f')
        text = `${state.collapsed?.[key] ? '▸ ' : '▾ '}${parts[i]}`
      }
      line.push(text == null ? '' : text)
    }
    return line
  }
  const pushData = (parts, bucket, prev, toggleLevel) => {
    pushRow(displayParts(parts, prev, toggleLevel).concat(valueCells(bucket)), {
      type: 'data',
      parts: parts.slice(),
      toggleKey: toggleLevel >= 0 ? parts.slice(0, toggleLevel + 1).map(String).join('\x1f') : '',
    })
  }
  const pushSub = (prefix) => {
    const labels = blankLabels()
    labels[0] = `${prefix[prefix.length - 1]}总计`
    const bucket = rowsMatching(state, rows, rowIdxs, prefix)
    pushRow(labels.concat(valueCells(bucket)), { type: 'sub', parts: prefix.slice() })
  }
  if (!rowIdxs.length) {
    pushData([], rows, null, -1)
  } else if (!showSubTotal) {
    let prev = null
    rowCombos.forEach((parts) => {
      pushData(parts, rowsMatching(state, rows, rowIdxs, parts), prev, -1)
      prev = parts
    })
  } else {
    const walk = (list, level, prevHolder) => {
      const groups = []
      list.forEach((parts) => {
        const k = String(parts[level] ?? '')
        let g = groups[groups.length - 1]
        if (!g || g.k !== k) {
          g = { k, parts, items: [] }
          groups.push(g)
        }
        g.items.push(parts)
      })
      groups.forEach((g) => {
        const prefix = g.parts.slice(0, level + 1)
        const key = prefix.map(String).join('\x1f')
        if (state.collapsed?.[key]) {
          const labels = blankLabels()
          labels[level] = `▸ ${prefix[level]}`
          const bucket = rowsMatching(state, rows, rowIdxs, prefix)
          pushRow(labels.concat(valueCells(bucket)), { type: 'data', parts: prefix.slice(), toggleKey: key })
          prevHolder.parts = prefix.concat(Array(rowIdxs.length - prefix.length).fill(''))
          return
        }
        if (level === rowIdxs.length - 2) {
          g.items.forEach((parts, i) => {
            pushData(parts, rowsMatching(state, rows, rowIdxs, parts), i ? prevHolder.parts : prevHolder.parts, i ? -1 : level)
            prevHolder.parts = parts
          })
        } else {
          walk(g.items, level + 1, prevHolder)
        }
        pushSub(prefix)
      })
    }
    walk(rowCombos, 0, { parts: null })
  }
  if (showRowTotal) {
    const labels = blankLabels()
    labels[0] = '总计'
    pushRow(labels.concat(valueCells(rows)), { type: 'total', parts: null })
  }
  const cols = []
  for (let i = 0; i < leftW; i++) cols.push({ type: 'label' })
  colCombos.forEach((parts) => {
    vals.forEach((v, vi) => cols.push({
      type: 'val',
      valIndex: vi,
      colKey: parts.map(String).join('\x1f'),
      colParts: parts.slice(),
      colLabel: parts.filter((p) => p !== '' && p != null).map(String).join(' / ') || valueLabel(state, v),
    }))
  })
  if (showColTotal) vals.forEach((v, vi) => cols.push({ type: 'total', valIndex: vi, colKey: '', colParts: null, colLabel: '总计' }))
  const layout = { headerRows: twoHead ? 2 : 1, leftW, rows: rowMeta, cols }
  applyShow(matrix, layout, vals)
  state._layout = layout
  return matrix
}

export function writePivotToSheet(sheet, matrix, startRow, startCol, headerRows, prev, layout) {
  if (!sheet) return false
  if (!sheet.cellData) sheet.cellData = {}
  if (prev?.rows && prev?.cols) {
    for (let rr = 0; rr < prev.rows; rr++) {
      const r0 = prev.startRow + rr
      if (!sheet.cellData[r0]) continue
      for (let cc = 0; cc < prev.cols; cc++) delete sheet.cellData[r0][prev.startColumn + cc]
    }
  }
  matrix.forEach((row, ri) => {
    const r = startRow + ri
    if (!sheet.cellData[r]) sheet.cellData[r] = {}
    row.forEach((v, ci) => {
      const n = typeof v === 'number' && Number.isFinite(v)
      const cell = n ? { v, t: 2 } : { v: String(v == null ? '' : v), t: 1 }
      const rowType = layout?.rows?.[ri]?.type
      const colType = layout?.cols?.[ci]?.type
      const summary = rowType === 'total' || rowType === 'sub' || (colType === 'total' && rowType !== 'head')
      if (ri < headerRows) cell.s = { bl: 1, bg: { rgb: '#E8F3FF' }, ht: 2 }
      else if (summary) cell.s = { bl: 1, bg: { rgb: '#DCE6F1' } }
      sheet.cellData[r][startCol + ci] = cell
    })
  })
  sheet.rowCount = Math.max(sheet.rowCount || 0, startRow + matrix.length + 4)
  sheet.columnCount = Math.max(sheet.columnCount || 0, startCol + (matrix[0]?.length || 0) + 4)
  return true
}

export function toPivotConfig(state) {
  return {
    range: state.range,
    sourceName: state.sourceName,
    outName: state.outName,
    filters: state.filters,
    rowsF: state.rowsF,
    cols: state.cols,
    values: state.values,
    calcFields: state.calcFields,
    showRowTotal: state.showRowTotal,
    showColTotal: state.showColTotal,
    showSubTotal: state.showSubTotal,
    repeatLabels: state.repeatLabels,
    fieldOpts: state.fieldOpts,
    collapsed: state.collapsed,
    out: state.out,
  }
}

export function applyPivotConfig(state, cfg) {
  if (!cfg) return
  if (cfg.range) state.range = cfg.range
  if (cfg.sourceName) state.sourceName = cfg.sourceName
  if (cfg.outName) state.outName = cfg.outName
  state.filters = cfg.filters || []
  state.rowsF = cfg.rowsF || []
  state.cols = cfg.cols || []
  state.values = (cfg.values || []).map((v) => ({ show: 'none', ...v }))
  state.calcFields = cfg.calcFields || []
  state.showRowTotal = cfg.showRowTotal !== false
  state.showColTotal = cfg.showColTotal !== false
  state.showSubTotal = cfg.showSubTotal !== false
  state.repeatLabels = !!cfg.repeatLabels
  state.fieldOpts = cfg.fieldOpts || {}
  state.collapsed = cfg.collapsed || {}
  state.out = cfg.out || null
}

export function retargetFields(state, oldHeaders, newHeaders) {
  const map = {}
  oldHeaders.forEach((name, i) => {
    const n = newHeaders.indexOf(name)
    if (n >= 0) map[i] = n
  })
  const ok = (idx) => isCalcId(idx) || Number.isInteger(map[idx])
  const conv = (idx) => (isCalcId(idx) ? idx : map[idx])
  state.rowsF = state.rowsF.filter(ok).map(conv)
  state.cols = state.cols.filter(ok).map(conv)
  state.filters = state.filters.filter((f) => ok(f.idx)).map((f) => ({ ...f, idx: conv(f.idx) }))
  state.values = state.values.filter((v) => ok(v.idx)).map((v) => ({ ...v, idx: conv(v.idx) }))
  const next = {}
  Object.keys(state.fieldOpts || {}).forEach((key) => {
    if (isCalcId(key)) { next[key] = state.fieldOpts[key]; return }
    const n = map[Number(key)]
    if (Number.isInteger(n)) next[String(n)] = state.fieldOpts[key]
  })
  state.fieldOpts = next
}

export function pivotDetailMatrix(state, rowParts, colParts) {
  const rows = (state.rows || []).filter((row) => rowPasses(state, row)).filter((row) => {
    const rowOk = !rowParts || rowParts.every((part, i) => String(rowValue(state, row, state.rowsF[i]) ?? '') === String(part ?? ''))
    const colOk = !colParts || colParts.every((part, i) => String(rowValue(state, row, state.cols[i]) ?? '') === String(part ?? ''))
    return rowOk && colOk
  })
  return [state.headers.slice(), ...rows.map((row) => row.slice())]
}

export function guessCondKind(values) {
  const sample = values.filter((v) => v !== '' && v != null)
  if (!sample.length) return 'text'
  const dates = sample.filter((v) => /^\d{4}[\/\-.]/.test(String(v)) && Number.isFinite(parseDateValue(v))).length
  if (dates * 2 >= sample.length) return 'date'
  const nums = sample.filter((v) => typeof v === 'number' || /^-?\d+(\.\d+)?$/.test(String(v))).length
  if (nums * 2 >= sample.length) return 'num'
  return 'text'
}
