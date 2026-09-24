<script setup>
import Icon from './Icon.vue'

defineProps({
  visible: Boolean,
  title: { type: String, default: '' },
  icon: { type: String, default: 'info-fill' },
  danger: Boolean,
  overflowVisible: Boolean,
  footEnd: Boolean,
  flush: Boolean,
  size: { type: String, default: '' },
  width: { type: [Number, String], default: 520 },
  height: { type: [Number, String], default: '' },
  zIndex: { type: Number, default: 280 },
})
const emit = defineEmits(['update:visible'])

function close() {
  emit('update:visible', false)
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="app-modal-mask show"
      :style="{ zIndex }"
      @mousedown.self="close"
    >
      <div
        class="app-modal"
        :class="[size, { loose: overflowVisible, 'foot-end': footEnd, flush }]"
        :style="{
          width: size ? undefined : (typeof width === 'number' ? `${width}px` : width),
          height: height ? (typeof height === 'number' ? `${height}px` : height) : undefined,
        }"
        role="dialog"
        aria-modal="true"
        @mousedown.stop
      >
        <header class="modal-head">
          <span class="mh-title">
            <span class="mh-ico" :class="{ danger, info: icon === 'warning' || icon === 'g-557e9ce3', ok: icon === 'g-968fa17e' }"><Icon :name="icon" :size="16" /></span>
            <slot name="title">{{ title }}</slot>
          </span>
          <button type="button" class="mh-x" aria-label="关闭" @click="close">✕</button>
        </header>
        <div class="modal-body"><slot /></div>
        <div v-if="$slots.footer" class="modal-foot"><slot name="footer" /></div>
      </div>
    </div>
  </Teleport>
</template>
