/** 飞书自定义数字格式：正数;负数;零;文本，以及日期、万元、手机号掩码 */

const WEEK_SHORT = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
const WEEK_FULL = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
const MONTH_NUM = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二']
const MONTH_FULL = ['', '一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月']

function pad(n, len = 2) {
  return String(n).padStart(len, '0')
}

function generalText(value) {
  if (value == null || value === '') return ''
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (Number.isInteger(value)) return String(value)
    return String(Number(value.toPrecision(12)))
  }
  return String(value)
}

function splitSections(code) {
  const parts = []
  let cur = ''
  let quoted = false
  for (let i = 0; i < code.length; i += 1) {
    const ch = code[i]
    if (ch === '"') {
      quoted = !quoted
      cur += ch
      continue
    }
    if ((ch === '\\' || ch === '!') && !quoted) {
      cur += ch + (code[i + 1] || '')
      i += 1
      continue
    }
    if (ch === ';' && !quoted) {
      parts.push(cur)
      cur = ''
      continue
    }
    cur += ch
  }
  parts.push(cur)
  return parts
}

function isDateCode(code) {
  return /\[h\]|\[m\]|\[s\]|yyyy|yy|dd|hh|ss|AM\/PM|A\/P|上午\/下午|aaa|mmm/i.test(code)
}

function excelSerialToDate(n) {
  const ms = Math.round((n - 25569) * 86400000)
  const d = new Date(ms)
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds())
}

function toDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return { date: value, serial: null }
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (value > 20000 && value < 80000) return { date: excelSerialToDate(value), serial: value }
    if (value >= 0 && value < 10) {
      const base = excelSerialToDate(25569 + value)
      return { date: base, serial: value }
    }
  }
  const s = String(value ?? '').trim()
  const m = s.match(/^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/)
  if (m) {
    return {
      date: new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)),
      serial: null,
    }
  }
  const t = s.match(/^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/)
  if (t) {
    return {
      date: new Date(2000, 0, 1, +t[1], +t[2], +(t[3] || 0)),
      serial: ((+t[1] * 3600) + (+t[2] * 60) + +(t[3] || 0)) / 86400,
    }
  }
  return null
}

function formatDate(date, code, serial) {
  const y = date.getFullYear()
  const mo = date.getMonth() + 1
  const day = date.getDate()
  const H = date.getHours()
  const mi = date.getMinutes()
  const sec = date.getSeconds()
  const wd = date.getDay()
  const use12 = /AM\/PM|A\/P|上午\/下午/.test(code)
  let h12 = H % 12
  if (h12 === 0) h12 = 12
  const hour = use12 ? h12 : H
  let out = ''
  let i = 0
  while (i < code.length) {
    if (code[i] === '"') {
      let j = i + 1
      let lit = ''
      while (j < code.length && code[j] !== '"') lit += code[j++]
      out += lit
      i = j + 1
      continue
    }
    if (code[i] === '\\' || code[i] === '!') {
      out += code[i + 1] || ''
      i += 2
      continue
    }
    const rest = code.slice(i)
    const take = (token, text) => {
      if (!rest.startsWith(token)) return false
      out += text
      i += token.length
      return true
    }
    if (take('yyyy', String(y))) continue
    if (take('yy', String(y).slice(-2))) continue
    if (take('mmmmm', MONTH_NUM[mo] || '')) continue
    if (take('mmmm', MONTH_FULL[mo] || '')) continue
    if (take('mmm', `${mo}月`)) continue
    if (take('dddd', WEEK_FULL[wd])) continue
    if (take('ddd', WEEK_SHORT[wd])) continue
    if (take('aaaa', WEEK_FULL[wd])) continue
    if (take('aaa', WEEK_SHORT[wd])) continue
    if (take('dd', pad(day))) continue
    if (take('d', String(day))) continue
    if (take('hh', pad(hour))) continue
    if (take('h', String(hour))) continue
    if (take('ss', pad(sec))) continue
    if (take('s', String(sec))) continue
    if (take('AM/PM', H < 12 ? '上午' : '下午')) continue
    if (take('上午/下午', H < 12 ? '上午' : '下午')) continue
    if (take('A/P', H < 12 ? 'A' : 'P')) continue
    if (take('[h]', String(Math.floor(Math.abs(serial ?? 0) * 24)))) continue
    if (take('[m]', String(Math.floor(Math.abs(serial ?? 0) * 1440)))) continue
    if (take('[s]', String(Math.floor(Math.abs(serial ?? 0) * 86400)))) continue
    const run = rest.match(/^[mM]+/)
    if (run) {
      const hasTime = /[hs]/i.test(code)
      const hasDate = /[yd]/i.test(code)
      const around = `${code.slice(Math.max(0, i - 3), i)}${code.slice(i + run[0].length, i + run[0].length + 3)}`
      const minute = hasTime && (!hasDate || /[hs]/i.test(around))
      const n = minute ? mi : mo
      out += run[0].length >= 2 ? pad(n) : String(n)
      i += run[0].length
      continue
    }
    out += code[i]
    i += 1
  }
  return out
}

function analyze(code) {
  const pieces = []
  let percent = false
  let sci = false
  let scale = 0
  let inDec = false
  let i = 0
  while (i < code.length) {
    const ch = code[i]
    if (ch === '"') {
      let j = i + 1
      let lit = ''
      while (j < code.length && code[j] !== '"') lit += code[j++]
      if (lit === '.' && !inDec) {
        inDec = true
        pieces.push({ t: 'dot' })
      } else pieces.push({ t: 'lit', v: lit })
      i = j + 1
      continue
    }
    if (ch === '!' || ch === '\\') {
      const next = code[i + 1] || ''
      if (next === '.' && !inDec) {
        inDec = true
        pieces.push({ t: 'dot' })
      } else pieces.push({ t: 'lit', v: next })
      i += 2
      continue
    }
    if (ch === '_') {
      pieces.push({ t: 'lit', v: ' ' })
      i += 2
      continue
    }
    if (ch === '%') {
      percent = true
      pieces.push({ t: 'lit', v: '%' })
      i += 1
      continue
    }
    if (ch === '.' && !inDec) {
      inDec = true
      pieces.push({ t: 'dot' })
      i += 1
      continue
    }
    if (ch === ',') {
      const prev = pieces[pieces.length - 1]
      const next = code[i + 1]
      if (prev && (prev.t === 'ph' || prev.t === 'dot') && (next == null || next === ',' || !/[0#?]/.test(next))) {
        scale += 1
        i += 1
        continue
      }
      pieces.push({ t: 'thou' })
      i += 1
      continue
    }
    if (ch === '0' || ch === '#' || ch === '?') {
      pieces.push({ t: 'ph', v: ch, dec: inDec })
      i += 1
      continue
    }
    if ((ch === 'E' || ch === 'e') && (code[i + 1] === '+' || code[i + 1] === '-')) {
      sci = true
      pieces.push({ t: 'sci' })
      i += 2
      continue
    }
    if (ch === '@') {
      pieces.push({ t: 'at' })
      i += 1
      continue
    }
    if (ch === '/') {
      pieces.push({ t: 'slash' })
      i += 1
      continue
    }
    pieces.push({ t: 'lit', v: ch })
    i += 1
  }
  return { pieces, percent, sci, scale }
}

function bestFraction(frac, denLen) {
  const max = 10 ** Math.max(1, denLen) - 1
  let bestN = 0
  let bestD = 1
  let bestErr = 1
  const limit = Math.min(max, 99)
  for (let d = 1; d <= limit; d += 1) {
    const n = Math.round(frac * d)
    const err = Math.abs(frac - n / d)
    if (err < bestErr) {
      bestErr = err
      bestN = n
      bestD = d
    }
  }
  return { n: bestN, d: bestD }
}

function isDigitMask(info) {
  if (info.pieces.some((p) => p.t === 'dot' || p.t === 'sci' || p.t === 'slash' || p.t === 'thou')) return false
  const ph = info.pieces.filter((p) => p.t === 'ph')
  if (ph.length < 2) return false
  return info.pieces.some((p) => p.t === 'lit' && String(p.v || '').trim())
}

function formatPieces(value, info, text) {
  const abs = Math.abs(value)
  let v = abs
  for (let i = 0; i < info.scale; i += 1) v /= 1000
  if (info.percent) v *= 100
  const ph = info.pieces.filter((p) => p.t === 'ph')
  const hasAt = info.pieces.some((p) => p.t === 'at')
  if (hasAt && !ph.length) {
    return info.pieces.map((p) => (p.t === 'at' ? text : (p.v || ''))).join('')
  }
  if (info.sci) {
    const sciAt = info.pieces.findIndex((p) => p.t === 'sci')
    const dec = info.pieces.filter((p, idx) => p.t === 'ph' && p.dec && idx < sciAt).length
    const exp = v === 0 ? 0 : Math.floor(Math.log10(v))
    const mant = v / 10 ** exp
    const body = mant.toFixed(dec)
    return `${body}E${exp >= 0 ? '+' : ''}${pad(Math.abs(exp))}`
  }
  if (info.pieces.some((p) => p.t === 'slash')) {
    const whole = Math.floor(v + 1e-10)
    const denLen = Math.max(1, ph.filter((p) => p.dec).length || 1)
    const { n, d } = bestFraction(v - whole, denLen)
    return n ? `${whole} ${n}/${d}` : String(whole)
  }
  if (isDigitMask(info)) {
    const digits = Math.round(v).toString().padStart(ph.length, '0').slice(-ph.length)
    let k = 0
    return info.pieces.map((p) => {
      if (p.t === 'ph') return digits[k++] || ''
      if (p.t === 'lit') return p.v
      return ''
    }).join('')
  }
  const intPh = ph.filter((p) => !p.dec)
  const decPh = ph.filter((p) => p.dec)
  const useThou = info.pieces.some((p) => p.t === 'thou')
  const rounded = Number(v.toFixed(decPh.length))
  let [intRaw, decRaw = ''] = Math.abs(rounded).toFixed(decPh.length).split('.')
  const minInt = intPh.filter((p) => p.v === '0').length
  if (minInt && intRaw.length < minInt) intRaw = intRaw.padStart(minInt, '0')
  if (intPh.length && !minInt && Number(intRaw) === 0 && decPh.length) intRaw = ''
  const intShown = useThou && intRaw ? intRaw.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : intRaw
  let decShown = ''
  for (let i = 0; i < decPh.length; i += 1) {
    const kind = decPh[i].v
    const digit = decRaw[i] || '0'
    const restZero = decRaw.slice(i).split('').every((d) => d === '0')
    if (kind === '#' && restZero) break
    decShown += kind === '?' && digit === '0' ? ' ' : digit
  }
  let placed = false
  let out = ''
  info.pieces.forEach((p) => {
    if (p.t === 'ph' && !p.dec) {
      if (!placed) {
        out += intShown
        placed = true
      }
    } else if (p.t === 'dot') {
      if (decShown || decPh.some((item) => item.v === '0')) out += `.${decShown}`
    } else if (p.t === 'lit') out += p.v
  })
  return out
}

function formatSection(value, code, text) {
  const body = String(code || '')
  if (!body || body === 'General' || body.startsWith('G/')) return generalText(value)
  const info = analyze(body)
  if (info.pieces.some((p) => p.t === 'at') && !info.pieces.some((p) => p.t === 'ph')) {
    return info.pieces.map((p) => (p.t === 'at' ? text : (p.v || ''))).join('')
  }
  if (!info.pieces.some((p) => p.t === 'ph' || p.t === 'at' || p.t === 'sci')) {
    return info.pieces.map((p) => p.v || '').join('')
  }
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return text
  return formatPieces(n, info, text)
}

export function formatByCode(value, code) {
  const src = String(code || '').trim()
  if (value == null || value === '') return ''
  if (!src || src === 'General' || src === 'G/通用格式') return generalText(value)
  if (src === '@') return String(value)
  const sections = splitSections(src)
  const head = sections[0] || ''
  if (isDateCode(head)) {
    const hit = toDate(value)
    if (hit) return formatDate(hit.date, head, hit.serial)
  }
  const n = typeof value === 'number' ? value : Number(String(value).replace(/,/g, '').replace(/%$/, ''))
  const text = String(value)
  if (!Number.isFinite(n)) {
    const sec = sections.length >= 4 ? sections[3] : sections[0]
    if (sections.length >= 4 || sec.includes('@')) return formatSection(text, sec, text)
    return text
  }
  if (n > 0) return formatSection(n, sections[0], text)
  if (n < 0) {
    const sec = sections[1] ?? sections[0]
    const shown = formatSection(Math.abs(n), sec, text)
    return sections.length === 1 && !shown.startsWith('-') ? `-${shown}` : shown
  }
  const zero = sections[2] ?? sections[0]
  return formatSection(0, zero, text)
}

