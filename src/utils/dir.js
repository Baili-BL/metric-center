export function dirChildName(c) {
  return typeof c === 'string' ? c : c?.name || c?.n || ''
}

export function dirChildKids(c) {
  if (!c || typeof c !== 'object') return null
  return c.children || c.kids || null
}

export function buildArcoDirTree(tree, options = {}) {
  const {
    prefix = '',
    leavesOf,
    leafKey = (item) => item.id || item.title,
    leafTitle = (item) => item.title,
  } = options
  return (tree || []).map((node) => {
    const name = dirChildName(node)
    const path = prefix ? `${prefix}/${name}` : name
    const kids = dirChildKids(node) || []
    const childDirs = buildArcoDirTree(kids, { ...options, prefix: path })
    const leaves = (typeof leavesOf === 'function' ? leavesOf(path) : []).map((item) => ({
      key: `item:${leafKey(item)}`,
      title: leafTitle(item),
      kind: 'item',
      item,
      isLeaf: true,
      draggable: false,
    }))
    return {
      key: path,
      title: name,
      kind: 'dir',
      path,
      draggable: false,
      children: [...childDirs, ...leaves],
    }
  })
}

export function collectExpandableDirKeys(tree, prefix = '') {
  const keys = []
  ;(tree || []).forEach((node) => {
    const name = dirChildName(node)
    const path = prefix ? `${prefix}/${name}` : name
    const kids = dirChildKids(node) || []
    if (kids.length) keys.push(path)
    if (kids.length) keys.push(...collectExpandableDirKeys(kids, path))
  })
  return keys
}

export function flattenDirs(tree, prefix = '', depth = 0) {
  const out = []
  ;(tree || []).forEach((node) => {
    const name = dirChildName(node)
    const path = prefix ? `${prefix}/${name}` : name
    out.push({ name, path, node, depth })
    const kids = dirChildKids(node)
    if (kids && kids.length) out.push(...flattenDirs(kids, path, depth + 1))
  })
  return out
}

export function dirLocate(tree, path) {
  if (!path) return null
  const parts = path.split('/')
  let container = tree
  let node = null
  let index = -1
  for (let i = 0; i < parts.length; i++) {
    index = container.findIndex((d) => dirChildName(d) === parts[i])
    if (index < 0) return null
    node = container[index]
    if (i < parts.length - 1) {
      if (typeof container[index] === 'string') container[index] = { name: container[index], children: [] }
      if (!container[index].children && !container[index].kids) container[index].children = []
      container = container[index].children || container[index].kids
    }
  }
  return { node, container, index }
}

export function dirAddUnder(tree, parentPath, name) {
  if (!parentPath) {
    if (tree.some((d) => dirChildName(d) === name)) return { ok: false, msg: '已存在同名一级目录' }
    tree.push({ name, children: [] })
    return { ok: true, path: name }
  }
  const loc = dirLocate(tree, parentPath)
  if (!loc) return { ok: false, msg: '上级目录不存在' }
  if (typeof loc.container[loc.index] === 'string') loc.container[loc.index] = { name: loc.container[loc.index], children: [] }
  const node = loc.container[loc.index]
  if (!node.children) node.children = node.kids || []
  if (node.children.some((c) => dirChildName(c) === name)) return { ok: false, msg: '该目录下已存在同名子目录' }
  node.children.push({ name, children: [] })
  return { ok: true, path: `${parentPath}/${name}` }
}

export function parentPathOf(path) {
  if (!path || !String(path).includes('/')) return ''
  return String(path).split('/').slice(0, -1).join('/')
}

export function dirMove(tree, fromPath, targetPath) {
  if (!fromPath) return { ok: false, msg: '请选择要移动的目录' }
  if (fromPath === targetPath) return { ok: false, msg: '不能移动到自身' }
  if (targetPath && (targetPath === fromPath || targetPath.startsWith(`${fromPath}/`))) {
    return { ok: false, msg: '不能移动到自己的子目录' }
  }
  const fromLoc = dirLocate(tree, fromPath)
  if (!fromLoc) return { ok: false, msg: '目录不存在' }
  const node = fromLoc.container[fromLoc.index]
  const name = dirChildName(node)
  const newPath = targetPath ? `${targetPath}/${name}` : name
  const level = newPath.split('/').filter(Boolean).length
  if (level > 6) return { ok: false, msg: '目录最多 6 级' }

  const siblings = targetPath
    ? (dirChildKids(dirLocate(tree, targetPath)?.node) || [])
    : tree
  if (siblings.some((c) => c !== node && dirChildName(c) === name)) {
    return { ok: false, msg: targetPath ? '目标目录下已存在同名目录' : '已存在同名一级目录' }
  }

  fromLoc.container.splice(fromLoc.index, 1)
  const insertNode = typeof node === 'string' ? { name: node, children: [] } : node
  if (!targetPath) {
    tree.push(insertNode)
  } else {
    const parentLoc = dirLocate(tree, targetPath)
    if (!parentLoc) return { ok: false, msg: '目标目录不存在' }
    if (typeof parentLoc.container[parentLoc.index] === 'string') {
      parentLoc.container[parentLoc.index] = { name: parentLoc.container[parentLoc.index], children: [] }
    }
    const parent = parentLoc.container[parentLoc.index]
    if (!parent.children) parent.children = parent.kids || []
    parent.children.push(insertNode)
  }
  return { ok: true, path: newPath, oldPath: fromPath }
}

export function dirInsertBefore(tree, fromPath, beforePath) {
  if (!fromPath || fromPath === beforePath) return { ok: true, skipped: true, path: fromPath }
  const fromLoc = dirLocate(tree, fromPath)
  if (!fromLoc) return { ok: false, msg: '目录不存在' }
  const node = fromLoc.container[fromLoc.index]
  fromLoc.container.splice(fromLoc.index, 1)
  const beforeLoc = dirLocate(tree, beforePath)
  if (!beforeLoc) return { ok: false, msg: '目标不存在' }
  beforeLoc.container.splice(beforeLoc.index, 0, node)
  return { ok: true, path: fromPath, oldPath: fromPath }
}

export function dirMoveDrop(tree, fromPath, targetPath) {
  if (!fromPath) return { ok: false, msg: '请选择要移动的目录' }
  if (fromPath === targetPath) return { ok: true, skipped: true, path: fromPath }
  if (targetPath && targetPath.startsWith(`${fromPath}/`)) {
    return { ok: false, msg: '不能移动到自己的子目录' }
  }
  const fromParent = parentPathOf(fromPath)
  const short = fromPath.split('/').pop()

  if (!targetPath) {
    if (!fromParent) return { ok: true, skipped: true, path: fromPath }
    const r = dirMove(tree, fromPath, '')
    return r.ok ? { ...r, msg: `已将「${short}」提升为一级目录` } : r
  }

  if (fromParent === targetPath) {
    return { ok: true, skipped: true, path: fromPath }
  }

  const r = dirMove(tree, fromPath, targetPath)
  return r.ok
    ? { ...r, msg: `已将「${short}」移动到「${targetPath.split('/').join(' / ')}」` }
    : r
}

export function toCascaderNodes(tree, prefix = '') {
  return (tree || []).map((node) => {
    const name = dirChildName(node)
    const path = prefix ? `${prefix}/${name}` : name
    const kids = dirChildKids(node) || []
    const item = { label: name, value: path }
    if (kids.length) item.children = toCascaderNodes(kids, path)
    return item
  })
}

export function remountPath(oldPath, newPath, value) {
  if (!value) return value
  if (value === oldPath) return newPath
  if (value.startsWith(`${oldPath}/`)) return newPath + value.slice(oldPath.length)
  return value
}

export function remountOwned(list, fromPath, toPath, pickDir, writeDir) {
  if (!fromPath || fromPath === toPath) return 0
  let n = 0
  list.forEach((it) => {
    const dir = pickDir(it)
    const next = remountPath(fromPath, toPath, dir)
    if (next !== dir) {
      writeDir(it, next)
      n++
    }
  })
  return n
}

export function dirRename(tree, path, name) {
  const loc = dirLocate(tree, path)
  if (!loc) return { ok: false, msg: '目录不存在' }
  const siblings = loc.container || []
  const conflict = siblings.some((c, i) => i !== loc.index && dirChildName(c) === name)
  if (conflict) return { ok: false, msg: path.includes('/') ? '同级已存在同名目录' : '已存在同名一级目录' }
  if (typeof loc.container[loc.index] === 'string') loc.container[loc.index] = name
  else loc.container[loc.index].name = name
  const parent = path.includes('/') ? path.split('/').slice(0, -1).join('/') : ''
  return { ok: true, path: parent ? `${parent}/${name}` : name }
}

export function dirRemove(tree, path) {
  const loc = dirLocate(tree, path)
  if (!loc) return { ok: false, msg: '目录不存在' }
  loc.container.splice(loc.index, 1)
  return { ok: true }
}

export function pathStarts(itemPath, dirPath) {
  if (!dirPath) return true
  const p = itemPath || ''
  return p === dirPath || p.startsWith(dirPath + '/') || dirPath === p.split('/')[0]
}

export function matchText(s, kw, exact) {
  if (!kw) return true
  const a = String(s || '').toLowerCase()
  const b = String(kw).toLowerCase()
  return exact ? a === b : a.includes(b)
}
