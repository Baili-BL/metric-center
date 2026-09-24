<script setup>
import { computed, nextTick, onMounted } from 'vue'
import { Message } from '@arco-design/web-vue'
import { buildArcoDirTree, dirChildKids, dirChildName } from '../utils/dir'
import {
  DIR_DRAG, clearDropHighlight, dragHitFromEvent, ensureDirDragListeners, endDirDrag, highlightDropNode,
  keyFromEvent, resolveDropTarget, startDirDrag,
} from '../utils/dir-drag'
import { useIndicatorStore } from '../stores/indicators'
import Icon from './Icon.vue'

const emit = defineEmits(['add', 'edit', 'remove', 'remove-item', 'move'])
const store = useIndicatorStore()

const treeData = computed(() => buildArcoDirTree(store.dirs, {
  leavesOf: (path) => store.itemsInDir(path),
  leafKey: (item) => item.id,
  leafTitle: (item) => item.title,
}))

const selectedKeys = computed(() => {
  if (store.currentItem) {
    const c = store.cards.find((x) => x.title === store.currentItem)
    return c ? [`item:${c.id}`] : []
  }
  return store.currentDir ? [store.currentDir] : []
})

const expandedKeys = computed(() => collectOpenKeys(store.dirs))

onMounted(ensureDirDragListeners)

function collectOpenKeys(list, prefix = '') {
  const keys = []
  ;(list || []).forEach((node) => {
    const name = dirChildName(node)
    const path = prefix ? `${prefix}/${name}` : name
    if (store.isOpen(path)) keys.push(path)
    const kids = dirChildKids(node)
    if (kids?.length) keys.push(...collectOpenKeys(kids, path))
  })
  return keys
}

function walkDirs(list, prefix, visit) {
  ;(list || []).forEach((node) => {
    const name = dirChildName(node)
    const path = prefix ? `${prefix}/${name}` : name
    visit(path)
    const kids = dirChildKids(node)
    if (kids?.length) walkDirs(kids, path, visit)
  })
}

function isItemNode(node) {
  return node?.kind === 'item' || String(node?.key || '').startsWith('item:')
}

function onSelect(_keys, { node, e }) {
  if (e?.target?.closest?.('.di-ops, .di-plus, .di-extra')) return
  if (node?.kind === 'item') store.selectItem(node.item.title)
  else if (node?.key) store.selectDir(node.key)
}

function onExpand(keys) {
  const open = new Set(keys.filter((k) => !String(k).startsWith('item:')))
  walkDirs(store.dirs, '', (path) => {
    store.expanded[path] = open.has(path)
  })
}

function onDragStart(e) {
  const el = e.target?.closest ? e.target : e.target?.parentElement
  if (el?.closest?.('.di-ops, .di-plus, .di-extra, .arco-tree-node-switcher')) {
    e.preventDefault()
    return
  }
  const hit = dragHitFromEvent(e)
  if (!hit) { e.preventDefault(); return }
  const kind = hit.dataset.dragKind
  if (kind === 'item') {
    const id = String(hit.dataset.dragKey || '').replace(/^item:/, '')
    const card = store.cards.find((c) => c.id === id || c.title === hit.dataset.dragLabel)
    startDirDrag({
      type: 'item',
      id: card?.id || id,
      name: card?.title || hit.dataset.dragLabel || '',
      label: card?.title || hit.dataset.dragLabel || '',
      item: card,
    }, e)
    return
  }
  if (kind === 'dir') {
    startDirDrag({ type: 'dir', path: hit.dataset.dragKey, label: hit.dataset.dragLabel || '' }, e)
    return
  }
  e.preventDefault()
}

function onDragOver(e) {
  if (!DIR_DRAG.payload) return
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
  highlightDropNode(e)
}

function onDragLeave(e) {
  if (!e.currentTarget.contains(e.relatedTarget)) {
    document.querySelectorAll('.arco-tree-node.drop-on').forEach((el) => el.classList.remove('drop-on'))
  }
}

function onDrop(e) {
  e.preventDefault()
  const payload = DIR_DRAG.payload
  const key = keyFromEvent(e)
  const target = resolveDropTarget(treeData.value, key)
  endDirDrag()
  if (!payload) return
  if (payload.type === 'dir') {
    const dest = target.path || ''
    if (dest) store.expanded[dest] = true
    const r = store.moveDir(payload.path, dest)
    if (!r || r.skipped) {
      nextTick(clearDropHighlight)
      return
    }
    if (!r.ok) Message.warning(r.msg)
    else if (r.msg) Message.success(r.msg)
    nextTick(clearDropHighlight)
    return
  }
  const path = target.path || ''
  const title = payload.item?.title || payload.name || payload.label
  if (!title) return
  if (!path) { Message.warning('请拖到具体目录'); return }
  store.expanded[path] = true
  const r = store.moveItem(title, path)
  if (!r.ok) Message.warning(r.msg)
  else Message.success(`已移动「${title}」到「${path.split('/').join(' / ')}」`)
  nextTick(clearDropHighlight)
}

function onMoveClick(node) {
  const item = isItemNode(node)
  emit('move', {
    kind: item ? 'item' : 'dir',
    path: item ? '' : String(node.key || ''),
    item: node.item,
    title: item ? (node.item?.title || node.title) : node.title,
  })
}

function isDirOpen(key) {
  return expandedKeys.value.includes(key)
}
</script>

<template>
  <div
    class="ic-dir-tree"
    @dragstart="onDragStart"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
  >
    <a-tree
      block-node
      size="small"
      :animation="false"
      :auto-expand-parent="false"
      :default-expand-all="false"
      :data="treeData"
      :selected-keys="selectedKeys"
      :expanded-keys="expandedKeys"
      @select="onSelect"
      @expand="onExpand"
    >
      <template #switcher-icon>
        <Icon name="chevron-right" :size="9" />
      </template>
      <template #title="node">
        <span
          class="di-hit"
          :draggable="true"
          :data-drag-kind="isItemNode(node) ? 'item' : 'dir'"
          :data-drag-key="String(node.key || '')"
          :data-drag-label="node.title"
        >
          <span class="di-icon">
            <Icon v-if="node.kind === 'item'" name="dir-ind" :size="13" />
            <Icon v-else :name="isDirOpen(node.key) ? 'folder-open' : 'folder'" :size="node.path?.includes('/') ? 13 : 14" />
          </span>
          <span class="di-name">{{ node.title }}</span>
        </span>
      </template>
      <template #extra="node">
        <span class="di-extra" :class="{ 'is-leaf': node.kind === 'item' }" @click.stop>
          <button
            v-if="node.kind !== 'item'"
            type="button"
            class="di-plus"
            title="添加子目录"
            @click="emit('add', node.key)"
          >＋</button>
          <span class="di-ops">
            <button type="button" title="移动" @mousedown.stop @click.stop="onMoveClick(node)"><Icon name="g-18d681d0" :size="14" /></button>
            <button v-if="node.kind !== 'item'" type="button" title="编辑" @click="emit('edit', node.key)"><Icon name="edit" :size="14" /></button>
            <button
              v-if="node.kind === 'item'"
              type="button"
              class="danger"
              title="删除"
              @click="emit('remove-item', node.item.title)"
            ><Icon name="trash" :size="14" /></button>
            <button
              v-else
              type="button"
              class="danger"
              title="删除"
              @click="emit('remove', node.key)"
            ><Icon name="trash" :size="14" /></button>
          </span>
          <span v-if="node.kind !== 'item'" class="di-cnt">{{ store.dirCount(node.key) }}</span>
        </span>
      </template>
    </a-tree>
  </div>
</template>
