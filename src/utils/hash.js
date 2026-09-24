export function hashStr(s) {
  let h = 0
  const str = String(s || '')
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0
  return h
}

export function rndSeries(seed, n, base, amp) {
  const out = []
  let v = base
  let s = seed
  for (let i = 0; i < n; i++) {
    s = (s * 9301 + 49297) % 233280
    v += (s / 233280 - 0.48) * amp
    out.push(Math.round(v * 10) / 10)
  }
  return out
}

export function monthLabels(n = 36) {
  const out = []
  const d = new Date(2023, 9, 1)
  for (let i = 0; i < n; i++) {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    out.push(`${y}-${m}`)
    d.setMonth(d.getMonth() + 1)
  }
  return out
}

export function todayStr() {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

export function nowStr() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

export function uid(prefix = 'C') {
  return prefix + String(10000 + Math.floor(Math.random() * 90000))
}

export const ME = '吴开文'
export const PEOPLE = ['吴开文', '李研', '王数', '赵策', '陈析']
export const PALETTE = ['#2f6bff', '#e34d59', '#12b76a', '#f2994a', '#7b61ff', '#56ccf2', '#c8102e', '#d4a017']
