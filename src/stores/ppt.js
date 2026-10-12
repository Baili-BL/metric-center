import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { ME, PEOPLE, hashStr, nowStr, todayStr, uid } from '../utils/hash'
import {
  dirAddUnder, dirChildKids, dirChildName, dirLocate, dirMoveDrop, dirRemove, dirRename,
  matchText, parentPathOf, pathStarts, remountPath,
} from '../utils/dir'
import {
  clone, defaultCover, defaultSlides, enDirName, normalizePptStyle, translatePpt, typeName,
} from '../views/ppt/ppt-model'

export const PPT_SCOPES = ['mine', 'shared', 'public']

const LS = 'ailab.ppt.v1'

function branch(name, kids = []) {
  return { name, children: kids.map((n) => ({ name: n, children: [] })) }
}

const DEFAULT_DIRS = {
  mine: [
    branch('黑色金属', ['螺纹', '热卷']),
    branch('有色金属', ['沪铜', '沪锌']),
    branch('能化', ['PVC', 'PE']),
    branch('农产品'),
    branch('宏观策略'),
    branch('英文PPT'),
  ],
  shared: [
    branch('黑色金属', ['螺纹', '热卷']),
    branch('能化', ['PVC']),
    branch('宏观策略'),
  ],
  public: [
    branch('黑色金属', ['螺纹', '热卷']),
    branch('有色金属', ['沪铜', '沪锌']),
    branch('能化', ['PVC', 'PE']),
    branch('农产品'),
    branch('宏观策略'),
  ],
}

function normalizeDirTree(list) {
  return (list || []).map((d) => {
    if (typeof d === 'string') return { name: d, children: [] }
    const name = d?.name || d?.n || ''
    if (!name) return null
    return { name, children: normalizeDirTree(d.children || d.kids || []) }
  }).filter(Boolean)
}

function ensureTreePath(tree, path) {
  const parts = String(path || '').split('/').filter(Boolean)
  if (!parts.length) return ''
  let cur = ''
  parts.forEach((name) => {
    const parent = cur
    const next = parent ? `${parent}/${name}` : name
    if (!dirLocate(tree, next)) dirAddUnder(tree, parent, name)
    cur = next
  })
  return cur
}

function cloneDirNode(node) {
  return {
    name: dirChildName(node),
    children: (dirChildKids(node) || []).map(cloneDirNode),
  }
}

function uniqueSiblingName(container, base) {
  const names = new Set((container || []).map(dirChildName))
  if (!names.has(base)) return base
  let i = 2
  while (names.has(`${base}${i}`)) i += 1
  return `${base}${i}`
}

function makePpt(cfg) {
  const title = cfg.title || '未命名PPT'
  const type = cfg.type || 'weekly'
  const cover = { ...defaultCover(title, type), date: cfg.date || todayStr(), ...(cfg.cover || {}) }
  if (!cover.date) cover.date = cfg.date || todayStr()
  const slides = cfg.slides?.length ? cfg.slides : defaultSlides(title, type)
  if (slides[0]?.kind === 'cover') slides[0].cover = { ...slides[0].cover, ...cover, title }
  return {
    id: cfg.id || uid('P'),
    title,
    type,
    lang: cfg.lang || 'zh',
    scope: cfg.scope || 'mine',
    shareSide: cfg.shareSide || '',
    dir: cfg.dir || '',
    coverTemplate: cover.template || 'navy',
    cover,
    slides,
    style: normalizePptStyle(cfg.style),
    published: !!cfg.published,
    reportId: cfg.reportId || '',
    shares: cfg.shares || [],
    creator: cfg.creator || ME,
    updater: cfg.updater || ME,
    date: cfg.date || todayStr(),
    updated: cfg.updated || todayStr(),
    mine: cfg.mine !== false,
    sourceId: cfg.sourceId || '',
  }
}

function seedPpts() {
  const mk = (scope, dir, title, type, extra = {}) => makePpt({
    scope,
    dir,
    title,
    type,
    published: extra.published !== false,
    creator: extra.creator || (scope === 'mine' ? ME : PEOPLE[(hashStr(title) % (PEOPLE.length - 1)) + 1]),
    shareSide: extra.shareSide || '',
    shares: extra.shares || [],
    lang: extra.lang || 'zh',
    cover: extra.cover,
    slides: extra.slides,
    date: extra.date,
  })
  return {
    mine: [
      mk('mine', '黑色金属/螺纹', '黑色金属周度策略', 'weekly', { date: '2026-10-08' }),
      mk('mine', '能化/PVC', 'PVC月度供需回顾', 'monthly', { date: '2026-10-02' }),
      mk('mine', '宏观策略', '宏观月度路演材料', 'roadshow', { date: '2026-09-28' }),
    ],
    shared: [
      mk('shared', '黑色金属', '螺纹热卷价差跟踪', 'weekly', {
        shareSide: 'out', shares: ['李研', '王数'], date: '2026-10-06',
      }),
      mk('shared', '能化', '能化品种周度会商', 'weekly', {
        shareSide: 'in', creator: '李研', shares: [ME], date: '2026-10-07',
      }),
    ],
    public: [
      mk('public', '黑色金属', '黑色金属周报（公共）', 'weekly', { creator: '赵策', date: '2026-10-09' }),
      mk('public', '有色金属', '有色金属月报（公共）', 'monthly', { creator: '陈析', date: '2026-10-01' }),
      mk('public', '宏观策略', '宏观专题：海外流动性', 'topic', { creator: '王数', date: '2026-09-22' }),
    ],
  }
}

function defaultPack() {
  return {
    dirs: clone(DEFAULT_DIRS),
    ppts: seedPpts(),
    reports: {},
  }
}

function loadPack() {
  const pack = defaultPack()
  try {
    const saved = JSON.parse(localStorage.getItem(LS) || 'null')
    if (!saved || typeof saved !== 'object') return pack
    PPT_SCOPES.forEach((sc) => {
      if (saved.dirs?.[sc]?.length) pack.dirs[sc] = normalizeDirTree(saved.dirs[sc])
      else pack.dirs[sc] = normalizeDirTree(pack.dirs[sc])
      if (saved.ppts?.[sc]?.length) pack.ppts[sc] = saved.ppts[sc]
      ;(pack.ppts[sc] || []).forEach((p) => { if (p.dir) ensureTreePath(pack.dirs[sc], p.dir) })
    })
    if (saved.reports && typeof saved.reports === 'object') pack.reports = saved.reports
  } catch { /* */ }
  return pack
}

export const usePptStore = defineStore('ppt', () => {
  const pack = ref(loadPack())
  const scope = ref('mine')
  const shareSide = ref('out')
  const currentDir = ref('')
  const currentItem = ref('')
  const expanded = ref({})
  const viewMode = ref('card')
  const filters = ref({ kw: '', nameKw: '', exact: false, dateFrom: '', dateTo: '', pptType: '', creator: '' })

  function persist() {
    try {
      localStorage.setItem(LS, JSON.stringify(pack.value))
      return true
    } catch {
      return false
    }
  }

  const dirs = computed(() => pack.value.dirs[scope.value] || [])
  const allPpts = computed(() => pack.value.ppts[scope.value] || [])

  const ppts = computed(() => {
    const list = allPpts.value
    if (scope.value !== 'shared') return list
    return list.filter((p) => (p.shareSide || 'out') === shareSide.value)
  })

  function visible(p) {
    const f = filters.value
    if (f.pptType && p.type !== f.pptType) return false
    if (f.creator && (p.creator || '') !== f.creator) return false
    if (f.dateFrom && (p.date || '') < f.dateFrom) return false
    if (f.dateTo && (p.date || '') > f.dateTo) return false
    const kw = f.nameKw || f.kw
    if (kw && !matchText(p.title, kw, f.exact) && !matchText(p.id, kw, f.exact)) return false
    return true
  }

  const filtered = computed(() => ppts.value.filter((p) => {
    if (!visible(p)) return false
    if (currentItem.value) return p.id === currentItem.value
    return pathStarts(p.dir, currentDir.value)
  }))

  const creators = computed(() => {
    const set = new Set()
    allPpts.value.forEach((p) => { if (p.creator) set.add(p.creator) })
    PEOPLE.forEach((n) => set.add(n))
    return [ME, ...[...set].filter((n) => n !== ME).sort((a, b) => a.localeCompare(b, 'zh'))]
  })

  function dirCount(path) {
    return ppts.value.filter((p) => pathStarts(p.dir, path)).length
  }

  function itemsInDir(path) {
    return ppts.value.filter((p) => (p.dir || '') === path)
  }

  function setScope(id) {
    if (!PPT_SCOPES.includes(id) || id === scope.value) return
    scope.value = id
    currentDir.value = ''
    currentItem.value = ''
    if (id === 'shared') shareSide.value = 'out'
  }

  function setShareSide(side) {
    shareSide.value = side === 'in' ? 'in' : 'out'
    currentDir.value = ''
    currentItem.value = ''
  }

  function selectDir(path) {
    currentDir.value = path || ''
    currentItem.value = ''
  }

  function selectItem(id) {
    const p = get(id)
    currentItem.value = id || ''
    currentDir.value = p?.dir || ''
  }

  function findById(id) {
    if (!id) return null
    for (const sc of PPT_SCOPES) {
      const ppt = (pack.value.ppts[sc] || []).find((p) => p.id === id)
      if (ppt) return { ppt, scope: sc }
    }
    return null
  }

  function get(id) {
    return allPpts.value.find((p) => p.id === id) || findById(id)?.ppt
  }

  function addDir(parent, name) {
    const n = String(name || '').trim()
    if (!n) return { ok: false, msg: '请填写目录名称' }
    if (/[/\\]/.test(n)) return { ok: false, msg: '目录名称不能包含斜杠' }
    const r = dirAddUnder(pack.value.dirs[scope.value], parent || '', n)
    if (r.ok) {
      currentDir.value = r.path
      currentItem.value = ''
      persist()
    }
    return r
  }

  function renameDir(path, name) {
    const n = String(name || '').trim()
    if (!n) return { ok: false, msg: '请填写目录名称' }
    if (/[/\\]/.test(n)) return { ok: false, msg: '目录名称不能包含斜杠' }
    const r = dirRename(pack.value.dirs[scope.value], path, n)
    if (r.ok) {
      pack.value.ppts[scope.value].forEach((p) => { p.dir = remountPath(path, r.path, p.dir) })
      if (currentDir.value) currentDir.value = remountPath(path, r.path, currentDir.value)
      persist()
    }
    return r
  }

  function copyDir(path) {
    if (!path) return { ok: false, msg: '请选择目录' }
    const tree = pack.value.dirs[scope.value]
    const loc = dirLocate(tree, path)
    if (!loc) return { ok: false, msg: '目录不存在' }
    const cloned = cloneDirNode(loc.node)
    const parent = parentPathOf(path)
    const siblings = parent ? (dirChildKids(dirLocate(tree, parent)?.node) || []) : tree
    cloned.name = uniqueSiblingName(siblings, `${dirChildName(cloned)} 副本`)
    if (parent) {
      const parentLoc = dirLocate(tree, parent)
      if (!parentLoc) return { ok: false, msg: '上级目录不存在' }
      const node = parentLoc.container[parentLoc.index]
      if (!node.children) node.children = []
      node.children.push(cloned)
    } else {
      tree.push(cloned)
    }
    const newPath = parent ? `${parent}/${cloned.name}` : cloned.name
    const copies = pack.value.ppts[scope.value]
      .filter((p) => pathStarts(p.dir, path))
      .map((p) => makePpt({
        ...clone(p),
        id: uid('P'),
        title: `${p.title} 副本`,
        dir: remountPath(path, newPath, p.dir),
        published: false,
        reportId: '',
        slides: clone(p.slides || []).map((s) => ({ ...s, id: uid('S') })),
        date: todayStr(),
        updated: todayStr(),
        updater: ME,
      }))
    pack.value.ppts[scope.value].unshift(...copies)
    currentDir.value = newPath
    currentItem.value = ''
    persist()
    return { ok: true, path: newPath, count: copies.length }
  }

  function removeDir(path) {
    const r = dirRemove(pack.value.dirs[scope.value], path)
    if (r.ok) {
      if (currentDir.value === path || String(currentDir.value).startsWith(`${path}/`)) currentDir.value = ''
      persist()
    }
    return r
  }

  function remountExpanded(oldPath, newPath) {
    const next = { ...expanded.value }
    Object.keys(next).forEach((k) => {
      const nk = remountPath(oldPath, newPath, k)
      if (nk !== k) {
        delete next[k]
        next[nk] = true
      }
    })
    if (newPath) next[newPath] = true
    expanded.value = next
  }

  function moveDir(fromPath, targetPath) {
    const res = dirMoveDrop(pack.value.dirs[scope.value], fromPath, targetPath)
    if (!res.ok || res.skipped) return res
    const from = res.oldPath || fromPath
    const to = res.path || from
    if (to !== from) {
      pack.value.ppts[scope.value].forEach((p) => { p.dir = remountPath(from, to, p.dir) })
      currentDir.value = remountPath(from, to, currentDir.value)
      remountExpanded(from, to)
      if (targetPath) expanded.value[targetPath] = true
    }
    pack.value.dirs[scope.value] = pack.value.dirs[scope.value].slice()
    persist()
    return res
  }

  function movePpts(ids, dir) {
    const set = new Set(ids)
    pack.value.ppts[scope.value].forEach((p) => { if (set.has(p.id)) p.dir = dir })
    persist()
  }

  function ensureDirPath(scopeId, path) {
    const parts = String(path || '').split('/').filter(Boolean)
    if (!parts.length) return ''
    const tree = pack.value.dirs[scopeId]
    let cur = ''
    parts.forEach((name) => {
      const parent = cur
      const next = parent ? `${parent}/${name}` : name
      if (!dirLocate(tree, next)) dirAddUnder(tree, parent, name)
      cur = next
    })
    return cur
  }

  function dirToEn(path) {
    if (!path) return { ok: false, msg: '请选择目录' }
    const destName = uniqueSiblingName(pack.value.dirs.mine, enDirName(String(path).split('/').pop() || path))
    const dest = ensureDirPath('mine', destName)
    const list = pack.value.ppts[scope.value].filter((p) => pathStarts(p.dir, path))
    if (!list.length) return { ok: false, msg: '该目录下暂无 PPT' }
    const copies = list.map((p) => {
      const nextDir = remountPath(path, dest, p.dir)
      ensureDirPath('mine', nextDir)
      const next = translatePpt(p, nextDir)
      next.creator = ME
      next.updater = ME
      next.date = todayStr()
      next.updated = todayStr()
      return next
    })
    pack.value.ppts.mine.unshift(...copies)
    persist()
    return { ok: true, path: dest, count: copies.length }
  }

  function pptToEn(id) {
    const found = findById(id)
    if (!found) return { ok: false, msg: 'PPT 不存在' }
    const dest = ensureDirPath('mine', enDirName(String(found.ppt.dir || '英文PPT').split('/').pop() || '英文PPT'))
    const next = translatePpt(found.ppt, dest)
    next.creator = ME
    next.updater = ME
    next.date = todayStr()
    next.updated = nowStr()
    pack.value.ppts.mine.unshift(next)
    persist()
    return { ok: true, ppt: next }
  }

  function createPpt(title, extra = {}) {
    const ppt = makePpt({
      title,
      type: extra.type || 'weekly',
      dir: extra.dir || currentDir.value || '',
      scope: 'mine',
      cover: extra.cover,
      slides: extra.slides,
      creator: ME,
      mine: true,
    })
    pack.value.ppts.mine.unshift(ppt)
    persist()
    return ppt
  }

  function savePpt(payload) {
    const found = findById(payload.id)
    if (!found) return { ok: false, msg: 'PPT 不存在' }
    const list = pack.value.ppts[found.scope]
    const idx = list.findIndex((p) => p.id === payload.id)
    if (idx < 0) return { ok: false, msg: 'PPT 不存在' }
    const cover = payload.cover || list[idx].cover
    const slides = payload.slides || list[idx].slides
    if (slides[0]?.kind === 'cover') {
      slides[0].cover = { ...(slides[0].cover || {}), ...cover, title: payload.title || cover.title }
      slides[0].title = payload.title || cover.title
    }
    list[idx] = {
      ...list[idx],
      ...payload,
      cover,
      slides,
      coverTemplate: cover.template || list[idx].coverTemplate,
      updated: nowStr(),
      updater: ME,
    }
    persist()
    return { ok: true, ppt: list[idx] }
  }

  function removePpt(id) {
    const found = findById(id)
    if (!found) return
    pack.value.ppts[found.scope] = pack.value.ppts[found.scope].filter((p) => p.id !== id)
    if (currentItem.value === id) currentItem.value = ''
    persist()
  }

  function copyPpt(id, destScope = 'mine', destDir) {
    const found = findById(id)
    if (!found) return { ok: false, msg: 'PPT 不存在' }
    const dir = destScope === 'mine' ? (destDir || found.ppt.dir || currentDir.value || '') : (destDir || found.ppt.dir)
    if (destScope === 'mine' && dir) ensureDirPath('mine', dir)
    const ppt = makePpt({
      ...clone(found.ppt),
      id: uid('P'),
      title: `${found.ppt.title} 副本`,
      scope: destScope,
      dir,
      shareSide: '',
      shares: [],
      published: false,
      reportId: '',
      sourceId: found.ppt.id,
      creator: ME,
      updater: ME,
      date: todayStr(),
      updated: todayStr(),
      mine: true,
      slides: clone(found.ppt.slides || []).map((s) => ({ ...s, id: uid('S') })),
    })
    pack.value.ppts[destScope].unshift(ppt)
    persist()
    return { ok: true, ppt }
  }

  function copyToMine(id) {
    const found = findById(id)
    if (!found) return { ok: false, msg: 'PPT 不存在' }
    const dir = ensureDirPath('mine', found.ppt.dir || '未分类')
    return copyPpt(id, 'mine', dir)
  }

  function sharePpt(id, users) {
    const found = findById(id)
    if (!found) return { ok: false, msg: 'PPT 不存在' }
    const names = (users || []).filter(Boolean)
    found.ppt.shares = names
    if (found.scope === 'mine' && names.length) {
      const exists = pack.value.ppts.shared.find((p) => p.sourceId === id && p.shareSide === 'out')
      const sharedCopy = makePpt({
        ...clone(found.ppt),
        id: exists?.id || uid('P'),
        scope: 'shared',
        shareSide: 'out',
        shares: names,
        sourceId: id,
        updated: nowStr(),
      })
      if (exists) {
        const i = pack.value.ppts.shared.findIndex((p) => p.id === exists.id)
        pack.value.ppts.shared[i] = sharedCopy
      } else {
        pack.value.ppts.shared.unshift(sharedCopy)
      }
    }
    persist()
    return { ok: true }
  }

  function unsharePpt(id) {
    const found = findById(id)
    if (!found) return { ok: false, msg: 'PPT 不存在' }
    found.ppt.shares = []
    pack.value.ppts.shared = pack.value.ppts.shared.filter((p) => p.id !== id && p.sourceId !== found.ppt.sourceId && p.sourceId !== id)
    persist()
    return { ok: true }
  }

  function publishPpt(id, on = true) {
    const p = get(id)
    if (!p) return { ok: false, msg: 'PPT 不存在' }
    p.published = !!on
    p.updated = nowStr()
    persist()
    return { ok: true, ppt: p }
  }

  function toReport(id) {
    const p = get(id)
    if (!p) return { ok: false, msg: 'PPT 不存在' }
    if (p.reportId && pack.value.reports[p.reportId]) {
      return { ok: true, report: pack.value.reports[p.reportId], existed: true }
    }
    const report = {
      id: uid('R'),
      pptId: p.id,
      title: p.title,
      type: p.type,
      pages: (p.slides || []).length,
      date: todayStr(),
      creator: ME,
    }
    pack.value.reports[report.id] = report
    p.reportId = report.id
    persist()
    return { ok: true, report }
  }

  function getReport(id) {
    const p = get(id)
    if (!p?.reportId) return null
    return pack.value.reports[p.reportId] || null
  }

  function mergePpts(ids, title) {
    const picked = ids.map((id) => findById(id)?.ppt).filter(Boolean)
    if (picked.length < 2) return { ok: false, msg: '请至少选择两份 PPT' }
    const cover = defaultCover(title || '合并PPT', picked[0].type)
    const mergedSlides = [
      {
        id: uid('S'),
        kind: 'cover',
        layout: '',
        pageNo: 0,
        title: cover.title,
        blocks: [],
        cover,
      },
    ]
    picked.forEach((p) => {
      ;(p.slides || []).forEach((s) => {
        if (s.kind === 'cover') return
        mergedSlides.push({ ...clone(s), id: uid('S') })
      })
    })
    mergedSlides.forEach((s, i) => { if (s.kind !== 'cover') s.pageNo = i })
    const ppt = createPpt(cover.title, {
      type: picked[0].type,
      dir: currentDir.value || picked[0].dir || '',
      cover,
      slides: mergedSlides,
    })
    return { ok: true, ppt }
  }

  return {
    pack, scope, shareSide, currentDir, currentItem, expanded, viewMode, filters,
    dirs, ppts, filtered, creators, dirCount, itemsInDir,
    setScope, setShareSide, selectDir, selectItem, findById, get,
    addDir, renameDir, copyDir, removeDir, moveDir, movePpts, dirToEn, pptToEn,
    createPpt, savePpt, removePpt, copyPpt, copyToMine, sharePpt, unsharePpt,
    publishPpt, toReport, getReport, mergePpts, persist,
    typeName,
  }
})
