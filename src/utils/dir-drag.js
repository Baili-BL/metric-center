export const DIR_DRAG = { payload: null }

let listening = false

export function startDirDrag(payload, e) {
  DIR_DRAG.payload = payload
  if (e?.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    try { e.dataTransfer.setData('text/plain', payload.label || payload.path || payload.id || payload.name || 'move') } catch { /* */ }
  }
  document.body.classList.add('is-ind-dragging')
}

export function clearDropHighlight() {
  document.querySelectorAll('.arco-tree-node.drop-on, .dir-item.drop-on, .dir-node.drop-on').forEach((el) => el.classList.remove('drop-on'))
  document.querySelectorAll('.arco-tree-node-title-highlight').forEach((el) => el.classList.remove('arco-tree-node-title-highlight'))
}

export function endDirDrag() {
  DIR_DRAG.payload = null
  document.body.classList.remove('is-ind-dragging')
  clearDropHighlight()
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(clearDropHighlight)
  }
}

export function ensureDirDragListeners() {
  if (listening || typeof document === 'undefined') return
  listening = true
  document.addEventListener('dragend', endDirDrag)
}

export function highlightDropNode(e) {
  if (!DIR_DRAG.payload) return null
  const node = e.target.closest?.('.arco-tree-node')
  document.querySelectorAll('.arco-tree-node.drop-on').forEach((el) => { if (el !== node) el.classList.remove('drop-on') })
  if (node) node.classList.add('drop-on')
  return node
}

export function eventEl(e) {
  return e.target?.closest ? e.target : e.target?.parentElement
}

export function dragHitFromEvent(e) {
  const el = eventEl(e)
  if (!el?.closest) return null
  return el.closest('[data-drag-kind]')
    || el.closest('.arco-tree-node')?.querySelector('[data-drag-kind]')
    || null
}

export function keyFromEvent(e) {
  const hit = dragHitFromEvent(e)
  if (hit?.getAttribute('data-drag-key')) return hit.getAttribute('data-drag-key')
  const node = eventEl(e)?.closest?.('.arco-tree-node')
  if (node?.getAttribute('data-key')) return node.getAttribute('data-key')
  const marked = node?.querySelector?.('[data-drag-key]')
  return marked?.getAttribute('data-drag-key') || ''
}

export function findParentDirKey(nodes, childKey, parent = '') {
  for (const n of nodes || []) {
    if (String(n.key) === String(childKey)) return parent
    const hit = findParentDirKey(n.children, childKey, n.kind === 'dir' ? n.key : parent)
    if (hit != null) return hit
  }
  return null
}

export function resolveDropTarget(treeData, key) {
  if (!key) return { kind: 'blank', path: '' }
  if (String(key).startsWith('item:')) {
    return { kind: 'item', path: findParentDirKey(treeData, key) || '' }
  }
  return { kind: 'dir', path: key }
}
