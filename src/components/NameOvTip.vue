<script setup>
import { onBeforeUnmount, onMounted, reactive } from 'vue'

const SEL = '.dir-item .di-name, .arco-tree-node .di-name, .cc-name, .mlg-name, .lt-name, .ci-ellipsis, .ind-name'
const state = reactive({ show: false, text: '', left: '0px', top: '0px', below: false, light: false, arrow: '14px' })
let current = null
let hideTimer = 0

function hide() {
  current = null
  state.show = false
  state.text = ''
}
function scheduleHide() {
  clearTimeout(hideTimer)
  hideTimer = setTimeout(hide, 60)
}
function isTruncated(el) {
  return !!el && el.scrollWidth > el.clientWidth + 1
}
function place(el) {
  if (!el || !isTruncated(el)) {
    if (current === el) hide()
    return
  }
  const text = (el.getAttribute('data-tip') || el.textContent || '').replace(/\s+/g, ' ').trim()
  if (!text) { hide(); return }
  clearTimeout(hideTimer)
  current = el
  state.text = text
  state.light = !!(
    el.classList.contains('cc-name')
    || el.classList.contains('mlg-name')
    || el.classList.contains('ci-ellipsis')
    || el.classList.contains('lt-name')
    || el.closest?.('.chart-card, .gal-grid')
  )
  state.below = false
  state.show = true
  requestAnimationFrame(() => {
    const tip = document.getElementById('nameOvTip')
    const r = el.getBoundingClientRect()
    const tw = tip?.offsetWidth || 160
    const th = tip?.offsetHeight || 32
    const pad = 8
    const cx = r.left + r.width / 2
    const left = Math.max(pad, Math.min(cx - tw / 2, window.innerWidth - tw - pad))
    let top = r.top - th - 10
    if (top < pad) {
      top = r.bottom + 10
      state.below = true
    }
    state.left = `${Math.round(left)}px`
    state.top = `${Math.round(top)}px`
    state.arrow = `${Math.max(12, Math.min(tw - 12, Math.round(cx - left)))}px`
  })
}
function onOver(e) {
  const el = e.target.closest?.(SEL)
  if (!el) {
    if (current) scheduleHide()
    return
  }
  requestAnimationFrame(() => place(el))
}
function onOut(e) {
  if (!current) return
  const to = e.relatedTarget
  if (to && (current.contains(to) || document.getElementById('nameOvTip')?.contains(to))) return
  if (to?.closest?.(SEL) === current) return
  scheduleHide()
}

onMounted(() => {
  document.addEventListener('mouseover', onOver)
  document.addEventListener('mouseout', onOut)
  document.addEventListener('scroll', hide, true)
  window.addEventListener('blur', hide)
})
onBeforeUnmount(() => {
  document.removeEventListener('mouseover', onOver)
  document.removeEventListener('mouseout', onOut)
  document.removeEventListener('scroll', hide, true)
  window.removeEventListener('blur', hide)
})
</script>

<template>
  <Teleport to="body">
    <div
      id="nameOvTip"
      class="name-ov-tip"
      :class="{ show: state.show, below: state.below, light: state.light }"
      :style="{ left: state.left, top: state.top, '--arrow-left': state.arrow }"
    >{{ state.text }}</div>
  </Teleport>
</template>
