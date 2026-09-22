<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { buildArcoDirTree, collectExpandableDirKeys } from '../utils/dir'
import {
  DIR_DRAG, clearDropHighlight, dragHitFromEvent, ensureDirDragListeners, endDirDrag, highlightDropNode,
  keyFromEvent, resolveDropTarget, startDirDrag,
} from '../utils/dir-drag'
import Icon from './Icon.vue'

const props = defineProps({
  tree: { type: Array, default: () => [] },
  current: { type: String, default: '' },
  currentItem: { type: String, default: '' },
  countOf: { type: Function, default: () => 0 },
  icon: { type: String, default: 'folder' },
  leafIcon: { type: String, default: 'dir-chart' },
  leavesOf: { type: Function, default: null },
  leafTitle: { type: Function, default: (item) => item.title || item.name },
  leafKey: { type: Function, default: (item) => item.id || item.title },
  showAll: { type: Boolean, default: true },
  ops: { type: String, default: 'menu' },
  movableItems: { type: Boolean, default: undefined },
  movableDirs: { type: Boolean, default: false },
})
const emit = defineEmits(['select', 'select-item', 'add', 'edit', 'edit-item', 'remove', 'remove-item', 'move', 'move-tip', 'drop-item', 'drop-dir'])

const canMoveItems = computed(() => (props.movableItems == null ? !!props.leavesOf : props.movableItems))

const treeData = computed(() => buildArcoDirTree(props.tree, {
  leavesOf: props.leavesOf || undefined,
  leafTitle: props.leafTitle,
  leafKey: props.leafKey,
}))

const expandedKeys = ref(collectExpandableDirKeys(props.tree))
watch(() => props.tree, (tree) => {
  const next = collectExpandableDirKeys(tree)
  const cur = new Set(expandedKeys.value)
  next.forEach((k) => { if (!cur.has(k)) expandedKeys.value.push(k) })
}, { deep: true })

const selectedKeys = computed(() => {
  if (props.currentItem) return [`item:${props.currentItem}`]
  return props.current ? [props.current] : []
})

onMounted(ensureDirDragListeners)

function emitMove(node) {
  const item = isItemNode(node)
  const payload = {
    kind: item ? 'item' : 'dir',
    path: item ? '' : String(node.key || ''),
    item: node.item,
    title: item ? (node.item?.title || node.item?.name || node.title) : node.title,
  }
  emit('move', payload)
  emit('move-tip', payload)
}

function isItemNode(node) {
  return node?.kind === 'item' || String(node?.key || '').startsWith('item:')
}

function canDrag(node) {
  if (isItemNode(node)) return canMoveItems.value
  return !!props.movableDirs
}

function onSelect(_keys, { node, e }) {
  if (e?.target?.closest?.('.di-ops, .di-extra, .arco-dropdown')) return
  if (node?.kind === 'item') emit('select-item', node.item)
  else if (node?.key) emit('select', node.key)
}

function findTreeNode(nodes, key) {
  for (const n of nodes || []) {
    if (String(n.key) === String(key)) return n
    const hit = findTreeNode(n.children, key)
    if (hit) return hit
  }
  return null
}

function onDragStart(e) {
  const el = e.target?.closest ? e.target : e.target?.parentElement
  if (el?.closest?.('.di-ops, .di-plus, .di-extra, .di-more, .arco-dropdown, .arco-tree-node-switcher')) {
    e.preventDefault()
    return
  }
  const hit = dragHitFromEvent(e)
  if (!hit) { e.preventDefault(); return }
  const kind = hit.dataset.dragKind
  if (kind === 'item' && canMoveItems.value) {
    const node = findTreeNode(treeData.value, hit.dataset.dragKey)
    const item = node?.item
    startDirDrag({
      type: 'item',
      id: item?.id || String(hit.dataset.dragKey || '').replace(/^item:/, ''),
      name: item?.name || item?.title || hit.dataset.dragLabel || '',
      label: item?.name || item?.title || hit.dataset.dragLabel || '',
      item,
    }, e)
    return
  }
  if (kind === 'dir' && props.movableDirs) {
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
  if (target.kind === 'dir' && target.path && !expandedKeys.value.includes(target.path)) {
    expandedKeys.value = [...expandedKeys.value, target.path]
  }
  if (payload.type === 'dir') {
    const dest = target.path || ''
    if (dest && !expandedKeys.value.includes(dest)) expandedKeys.value.push(dest)
    emit('drop-dir', payload.path, dest)
  } else {
    emit('drop-item', payload, target.path || '')
  }
  nextTick(clearDropHighlight)
}
</script>

<template>
  <div
    class="dir-tree"
    @dragstart="onDragStart"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
  >
    <button
      v-if="showAll"
      type="button"
      class="dir-node"
      :class="{ active: !current && !currentItem }"
      @click="emit('select', '')"
    >
      <Icon name="folder-open" :size="14" />
      <span>全部</span>
      <span class="cnt">{{ countOf('') }}</span>
    </button>
    <a-tree
      block-node
      size="small"
      :animation="false"
      :auto-expand-parent="false"
      :default-expand-all="false"
      :data="treeData"
      :selected-keys="selectedKeys"
      v-model:expanded-keys="expandedKeys"
      @select="onSelect"
    >
      <template #switcher-icon>
        <Icon :name="ops === 'icons' ? 'chevron-right' : 'caret-down'" :size="ops === 'icons' ? 9 : 10" />
      </template>
      <template #title="node">
        <span
          class="di-hit"
          :draggable="canDrag(node)"
          :data-drag-kind="isItemNode(node) ? 'item' : 'dir'"
          :data-drag-key="String(node.key || '')"
          :data-drag-label="node.title"
        >
          <span class="di-icon">
            <Icon v-if="node.kind === 'item'" :name="leafIcon" :size="13" />
            <Icon v-else :name="expandedKeys.includes(node.key) ? 'folder-open' : icon" :size="14" />
          </span>
          <span class="di-name">{{ node.title }}</span>
        </span>
      </template>
      <template #extra="node">
        <span v-if="ops === 'icons'" class="di-extra" :class="{ 'is-leaf': node.kind === 'item' }" @click.stop>
          <button
            v-if="node.kind !== 'item' && String(node.key || '').split('/').filter(Boolean).length < 6"
            type="button"
            class="di-plus"
            title="添加子目录"
            @click="emit('add', node.key)"
          >＋</button>
          <span class="di-ops">
            <button type="button" title="移动" @mousedown.stop @click.stop="emitMove(node)"><Icon name="g-18d681d0" :size="14" /></button>
            <button
              v-if="node.kind !== 'item'"
              type="button"
              title="编辑"
              @click="emit('edit', node.key)"
            ><Icon name="edit" :size="14" /></button>
            <button
              v-else
              type="button"
              title="编辑"
              @click="emit('edit-item', node.item)"
            ><Icon name="edit" :size="14" /></button>
            <button
              type="button"
              class="danger"
              title="删除"
              @click="node.kind === 'item' ? emit('remove-item', node.item) : emit('remove', node.key)"
            ><Icon name="trash" :size="14" /></button>
          </span>
          <span v-if="node.kind !== 'item'" class="di-cnt">{{ countOf(node.key) }}</span>
        </span>
        <span v-else class="di-extra" @click.stop>
          <span v-if="node.kind !== 'item'" class="cnt">{{ countOf(node.key) }}</span>
          <a-dropdown v-if="node.kind !== 'item'" trigger="hover">
            <span class="di-more" @click.stop>
              <Icon name="more" :size="12" />
            </span>
            <template #content>
              <a-doption @click="emit('add', node.key)">添加子目录</a-doption>
              <a-doption @click="emit('edit', node.key)">重命名</a-doption>
              <a-doption @click="emit('remove', node.key)">删除</a-doption>
            </template>
          </a-dropdown>
        </span>
      </template>
    </a-tree>
  </div>
</template>
