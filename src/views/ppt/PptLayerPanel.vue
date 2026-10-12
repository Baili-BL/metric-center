<script setup>
import { computed, reactive, ref } from 'vue'
import ColorPop, { placeColorPop } from '../../components/ColorPop.vue'
import PptFontSelect from './PptFontSelect.vue'
import PptShapeSvg from './PptShapeSvg.vue'
import { TEXT_SIZES } from './ppt-model'
import { ARROWS, DASHES, SHAPE_GROUPS, STROKE_WIDTHS, TEXTBOX_PRESETS, dashArray, dashCap, shapeById } from './ppt-shapes'

const props = defineProps({
  modelValue: { type: Object, default: null },
  disabled: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue', 'insert', 'insert-text', 'remove'])

const openKeys = ref(['textbox', 'stroke', 'text'])
const tbTab = ref('default')
const tbDir = ref('h')
const selected = computed(() => props.modelValue)
const def = computed(() => (selected.value ? shapeById(selected.value.shape) : null))
const isLine = computed(() => selected.value?.kind === 'line')
const isClosed = computed(() => selected.value && selected.value.kind !== 'line')
const isTextBox = computed(() => selected.value?.kind === 'text')
const isText = computed(() => {
  if (!selected.value) return false
  return selected.value.kind === 'text' || !!String(selected.value.text || '').trim() || selected.value.kind === 'closed'
})

const colorPick = reactive({ show: false, left: 0, top: 0, origin: '#333', kind: '' })

function patch(partial) {
  if (props.disabled || !selected.value) return
  emit('update:modelValue', { ...selected.value, ...partial })
}

function bind(key, map = (v) => v) {
  return computed({
    get: () => selected.value?.[key],
    set: (v) => patch({ [key]: map(v) }),
  })
}

const strokeWidth = bind('strokeWidth', Number)
const strokeDash = computed({
  get: () => {
    const id = selected.value?.strokeDash
    if (id === 'dot') return 'roundDot'
    if (id === 'dashdot') return 'dashDot'
    return id || 'solid'
  },
  set: (v) => patch({ strokeDash: v }),
})
const arrows = bind('arrows')
const fillNone = computed(() => !!selected.value?.fillNone)
const fillMode = computed(() => (fillNone.value ? 'none' : 'solid'))
const strokeNone = computed(() => !!selected.value?.strokeNone)
const strokeMode = computed(() => (strokeNone.value ? 'none' : 'solid'))
const fillAlpha = computed({
  get: () => Number(selected.value?.fillAlpha) || 0,
  set: (v) => patch({ fillAlpha: Number(v) || 0 }),
})

function setFillMode(mode) {
  if (mode === 'none') patch({ fillNone: true })
  else patch({ fillNone: false, fill: selected.value?.fill || '#ffffff' })
}
function toggleFillNone() {
  setFillMode(fillNone.value ? 'solid' : 'none')
}
function setStrokeMode(mode) {
  patch({ strokeNone: mode === 'none' })
}
function toggleStrokeNone() {
  setStrokeMode(strokeNone.value ? 'solid' : 'none')
}
const font = bind('fontFamily')
const fontSize = bind('fontSize', Number)
const text = bind('text', (v) => String(v ?? ''))
const writingMode = computed({
  get: () => selected.value?.writingMode === 'vertical' ? 'vertical' : 'horizontal',
  set: (v) => patch({ writingMode: v === 'vertical' ? 'vertical' : 'horizontal' }),
})

function openColor(e, kind, origin) {
  if (props.disabled || !selected.value) return
  const pos = placeColorPop(e.currentTarget)
  colorPick.kind = kind
  colorPick.origin = origin
  colorPick.left = pos.left
  colorPick.top = pos.top
  colorPick.show = true
}
function onColorPick(hex) {
  if (colorPick.kind === 'strokeColor') patch({ strokeColor: hex, strokeNone: false })
  else if (colorPick.kind === 'fill') patch({ fill: hex, fillNone: false })
  else if (colorPick.kind === 'color') patch({ color: hex })
}

function insertText(preset) {
  emit('insert-text', { preset, dir: tbDir.value })
}
</script>

<template>
  <div class="plp" :class="{ off: disabled }">
    <a-collapse v-model:active-key="openKeys" :bordered="false" expand-icon-position="right">
      <a-collapse-item key="textbox" header="插入文本框">
        <div class="plp-body">
          <div class="plp-tb-tabs">
            <button type="button" :class="{ on: tbTab === 'default' }" @click="tbTab = 'default'">默认文本框</button>
            <button type="button" :class="{ on: tbTab === 'custom' }" @click="tbTab = 'custom'">自定义文本框</button>
          </div>
          <div class="plp-tb-bar">
            <span>{{ tbTab === 'custom' ? '自定义' : '默认' }}</span>
            <div class="plp-tb-dir">
              <button type="button" :class="{ on: tbDir === 'h' }" title="横向" @click="tbDir = 'h'">横向</button>
              <button type="button" :class="{ on: tbDir === 'v' }" title="竖向" @click="tbDir = 'v'">竖向</button>
            </div>
          </div>
          <div v-if="tbTab === 'default'" class="plp-tb-cards" :class="{ vert: tbDir === 'v' }">
            <button
              v-for="p in TEXTBOX_PRESETS"
              :key="p.id"
              type="button"
              class="plp-tb-card"
              :disabled="disabled"
              @click="insertText(p.id)"
            >
              <span class="plp-tb-sample" :class="[p.id, { vert: tbDir === 'v' }]">{{ p.name }}</span>
            </button>
          </div>
          <button
            v-else
            type="button"
            class="plp-tb-custom"
            :class="{ vert: tbDir === 'v' }"
            :disabled="disabled"
            @click="insertText('custom')"
          >
            <span>单击插入文本框</span>
          </button>
        </div>
      </a-collapse-item>

      <a-collapse-item key="shape" header="插入形状">
        <div class="plp-body">
          <div v-for="g in SHAPE_GROUPS" :key="g.id" class="plp-cat">
            <h5>{{ g.name }}</h5>
            <div class="plp-grid">
              <button
                v-for="it in g.items"
                :key="it.id"
                type="button"
                class="plp-pick"
                :title="it.name"
                :disabled="disabled"
                @click="emit('insert', it.id)"
              >
                <PptShapeSvg :shape-id="it.id" preview />
              </button>
            </div>
          </div>
        </div>
      </a-collapse-item>

      <a-collapse-item key="line" header="线条设置">
        <div class="plp-body">
          <div v-if="!isLine" class="plp-hint">请选择线条元素</div>
          <div v-else class="plp-toolbar">
            <a-select v-model="strokeWidth" size="small" :disabled="disabled" popup-container="body" class="plp-sw" style="width: 108px">
              <a-option v-for="n in STROKE_WIDTHS" :key="'lw' + n" :value="n" :label="n + '磅'">
                <span class="plp-sw-opt"><i :style="{ height: Math.max(1, n) + 'px' }" />{{ n }}磅</span>
              </a-option>
            </a-select>
            <a-select v-model="strokeDash" size="small" :disabled="disabled" popup-container="body" class="plp-ds" style="width: 118px">
              <a-option v-for="d in DASHES" :key="d.id" :value="d.id" :label="d.label">
                <svg class="plp-dash-svg" viewBox="0 0 88 14" aria-hidden="true">
                  <line
                    x1="4" y1="7" x2="84" y2="7"
                    stroke="currentColor"
                    stroke-width="2"
                    :stroke-linecap="dashCap(d.id)"
                    :stroke-dasharray="dashArray(d.id, 2) || undefined"
                  />
                </svg>
              </a-option>
            </a-select>
            <a-select v-model="arrows" size="small" :disabled="disabled" popup-container="body" style="width: 88px">
              <a-option v-for="a in ARROWS" :key="a.id" :value="a.id">{{ a.label }}</a-option>
            </a-select>
            <button
              type="button"
              class="fmt-swatch color-well"
              title="线条颜色"
              :disabled="disabled"
              :style="{ background: selected.strokeColor }"
              @click.stop="openColor($event, 'strokeColor', selected.strokeColor)"
            />
          </div>
        </div>
      </a-collapse-item>

      <a-collapse-item key="stroke" header="线框设置">
        <div class="plp-body">
          <div v-if="!isClosed" class="plp-hint">请选择形状或文本框</div>
          <template v-else-if="isTextBox">
            <div class="plp-sec">
              <div class="plp-sec-h">
                <b>文本填充</b>
                <button
                  type="button"
                  class="fmt-swatch color-well"
                  title="填充颜色"
                  :disabled="disabled"
                  :style="{ background: fillNone ? 'transparent' : (selected.fill || '#ffffff') }"
                  @click.stop="openColor($event, 'fill', selected.fill || '#ffffff')"
                />
              </div>
              <button type="button" class="plp-opt" :class="{ on: fillMode === 'none' }" :disabled="disabled" @click="toggleFillNone">无填充</button>
              <button type="button" class="plp-opt" :class="{ on: fillMode === 'solid' }" :disabled="disabled" @click="setFillMode('solid')">纯色填充</button>
              <div v-if="fillMode === 'solid'" class="plp-alpha">
                <span>透明度</span>
                <a-slider v-model="fillAlpha" :min="0" :max="100" :show-tooltip="false" />
                <em>{{ fillAlpha }}%</em>
              </div>
            </div>
            <div class="plp-sec">
              <div class="plp-sec-h">
                <b>文本轮廓</b>
                <button
                  type="button"
                  class="fmt-swatch color-well"
                  title="线条颜色"
                  :disabled="disabled"
                  :style="{ background: selected.strokeColor }"
                  @click.stop="openColor($event, 'strokeColor', selected.strokeColor)"
                />
              </div>
              <button type="button" class="plp-opt" :class="{ on: strokeMode === 'none' }" :disabled="disabled" @click="toggleStrokeNone">无线条</button>
              <button type="button" class="plp-opt" :class="{ on: strokeMode === 'solid' }" :disabled="disabled" @click="setStrokeMode('solid')">实线</button>
              <div v-if="strokeMode === 'solid'" class="plp-toolbar">
                <a-select v-model="strokeWidth" size="small" :disabled="disabled" popup-container="body" class="plp-sw" style="width: 108px">
                  <a-option v-for="n in STROKE_WIDTHS" :key="'tbw' + n" :value="n" :label="n + '磅'">
                    <span class="plp-sw-opt"><i :style="{ height: Math.max(1, n) + 'px' }" />{{ n }}磅</span>
                  </a-option>
                </a-select>
                <a-select v-model="strokeDash" size="small" :disabled="disabled" popup-container="body" class="plp-ds" style="width: 118px">
                  <a-option v-for="d in DASHES" :key="'tbd' + d.id" :value="d.id" :label="d.label">
                    <svg class="plp-dash-svg" viewBox="0 0 88 14" aria-hidden="true">
                      <line
                        x1="4" y1="7" x2="84" y2="7"
                        stroke="currentColor"
                        stroke-width="2"
                        :stroke-linecap="dashCap(d.id)"
                        :stroke-dasharray="dashArray(d.id, 2) || undefined"
                      />
                    </svg>
                  </a-option>
                </a-select>
              </div>
            </div>
          </template>
          <div v-else class="plp-toolbar">
            <a-select v-model="strokeWidth" size="small" :disabled="disabled" popup-container="body" class="plp-sw" style="width: 108px">
              <a-option v-for="n in STROKE_WIDTHS" :key="'sw' + n" :value="n" :label="n + '磅'">
                <span class="plp-sw-opt"><i :style="{ height: Math.max(1, n) + 'px' }" />{{ n }}磅</span>
              </a-option>
            </a-select>
            <a-select v-model="strokeDash" size="small" :disabled="disabled" popup-container="body" class="plp-ds" style="width: 118px">
              <a-option v-for="d in DASHES" :key="'s' + d.id" :value="d.id" :label="d.label">
                <svg class="plp-dash-svg" viewBox="0 0 88 14" aria-hidden="true">
                  <line
                    x1="4" y1="7" x2="84" y2="7"
                    stroke="currentColor"
                    stroke-width="2"
                    :stroke-linecap="dashCap(d.id)"
                    :stroke-dasharray="dashArray(d.id, 2) || undefined"
                  />
                </svg>
              </a-option>
            </a-select>
            <button
              type="button"
              class="fmt-swatch color-well"
              title="线条颜色"
              :disabled="disabled"
              :style="{ background: selected.strokeColor }"
              @click.stop="openColor($event, 'strokeColor', selected.strokeColor)"
            />
            <button
              type="button"
              class="fmt-swatch color-well"
              title="填充颜色"
              :disabled="disabled"
              :style="{ background: selected.fillNone ? 'transparent' : selected.fill }"
              @click.stop="openColor($event, 'fill', selected.fill || '#dbe7ff')"
            />
            <button
              type="button"
              class="plp-none"
              title="无填充"
              :class="{ on: selected.fillNone }"
              :disabled="disabled"
              @click="toggleFillNone"
            />
          </div>
        </div>
      </a-collapse-item>

      <a-collapse-item key="text" header="文本设置">
        <div class="plp-body">
          <div v-if="!selected" class="plp-hint">请选择文本元素</div>
          <template v-else-if="isText">
            <a-textarea v-model="text" :disabled="disabled" :auto-size="{ minRows: 2, maxRows: 4 }" placeholder="输入文本" />
            <div class="plp-toolbar">
              <PptFontSelect v-model="font" :disabled="disabled" />
            </div>
            <div class="plp-toolbar">
              <a-select v-model="fontSize" size="small" :disabled="disabled" popup-container="body" style="width: 88px">
                <a-option v-for="n in TEXT_SIZES" :key="'fs' + n" :value="n">{{ n }} px</a-option>
              </a-select>
              <a-button-group size="mini">
                <a-button :type="selected.bold ? 'primary' : 'outline'" :disabled="disabled" @click="patch({ bold: !selected.bold })">B</a-button>
                <a-button class="ps-fmt-i" :type="selected.italic ? 'primary' : 'outline'" :disabled="disabled" @click="patch({ italic: !selected.italic })">I</a-button>
                <a-button :type="selected.align === 'left' ? 'primary' : 'outline'" :disabled="disabled" @click="patch({ align: 'left' })">左</a-button>
                <a-button :type="selected.align === 'center' ? 'primary' : 'outline'" :disabled="disabled" @click="patch({ align: 'center' })">中</a-button>
                <a-button :type="selected.align === 'right' ? 'primary' : 'outline'" :disabled="disabled" @click="patch({ align: 'right' })">右</a-button>
              </a-button-group>
              <button
                type="button"
                class="fmt-color color-well"
                title="文字颜色"
                :disabled="disabled"
                :style="{ '--swatch': selected.color }"
                @click.stop="openColor($event, 'color', selected.color)"
              >A</button>
            </div>
            <div class="plp-toolbar">
              <a-button-group size="mini">
                <a-button :type="writingMode === 'horizontal' ? 'primary' : 'outline'" :disabled="disabled" @click="writingMode = 'horizontal'">横向</a-button>
                <a-button :type="writingMode === 'vertical' ? 'primary' : 'outline'" :disabled="disabled" @click="writingMode = 'vertical'">竖向</a-button>
              </a-button-group>
            </div>
          </template>
          <div v-else class="plp-hint">请选择文本元素</div>
        </div>
      </a-collapse-item>
    </a-collapse>
    <div v-if="selected" class="plp-foot">
      <p class="plp-tip">已选：{{ def?.name || '形状' }}</p>
      <button type="button" class="plp-del" :disabled="disabled" @click="emit('remove')">删除图层</button>
    </div>

    <Teleport to="body">
      <ColorPop
        :show="colorPick.show"
        :left="colorPick.left"
        :top="colorPick.top"
        :origin="colorPick.origin"
        @update:show="colorPick.show = $event"
        @pick="onColorPick"
      />
    </Teleport>
  </div>
</template>
