<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import Icon from '../../components/Icon.vue'

const props = defineProps({
  modelValue: { type: String, default: '' },
  names: { type: Array, default: () => [] },
  placeholder: { type: String, default: '搜索并选择指标' },
  rangeOf: { type: Function, default: null },
  exact: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue', 'picked'])

const open = ref(false)
const kw = ref('')
const root = ref(null)
const selected = computed(() => !!props.modelValue)
const display = computed(() => props.modelValue || kw.value)
const items = computed(() => {
  const q = (open.value && !selected.value ? kw.value : '').trim()
  if (!q) return props.names
  if (props.exact) return props.names.filter((n) => String(n) === q)
  const k = q.toLowerCase()
  return props.names.filter((n) => String(n).toLowerCase().includes(k))
})
const range = computed(() => (props.modelValue && props.rangeOf ? props.rangeOf(props.modelValue) : ''))

function onFocus() {
  if (props.disabled) return
  kw.value = ''
  open.value = true
}
function onInput(e) {
  kw.value = e.target.value
  emit('update:modelValue', '')
  open.value = true
}
function pick(name) {
  kw.value = ''
  emit('update:modelValue', name)
  emit('picked', name)
  open.value = false
}
function onDoc(e) {
  if (!root.value?.contains(e.target)) open.value = false
}
onMounted(() => document.addEventListener('click', onDoc))
onBeforeUnmount(() => document.removeEventListener('click', onDoc))
</script>

<template>
  <div ref="root" class="picker" :class="{ open }">
    <span class="pk-search"><Icon name="search" :size="13" /></span>
    <input
      type="text"
      :placeholder="placeholder"
      :value="display"
      :disabled="disabled"
      autocomplete="off"
      @focus="onFocus"
      @input="onInput"
    >
    <span class="chev"><Icon name="chevron-down" :size="12" /></span>
    <div class="picker-list">
      <div v-if="!items.length" class="picker-empty">无匹配指标</div>
      <div v-for="n in items" :key="n" class="picker-item" @mousedown.prevent="pick(n)">{{ n }}</div>
    </div>
    <div v-if="range" class="picker-range">{{ range }}</div>
  </div>
</template>
