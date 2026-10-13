<script setup>
import { computed, reactive, ref } from 'vue'
import ColorPop, { placeColorPop } from '../../components/ColorPop.vue'
import PptFontSelect from './PptFontSelect.vue'
import {
  PPT_PALETTES, TEXT_SIZES, normalizePptStyle, pptPalette,
} from './ppt-model'

const props = defineProps({
  modelValue: { type: Object, default: null },
  disabled: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue'])

const openKeys = ref(['global', 'layout', 'widget'])
const s = computed(() => normalizePptStyle(props.modelValue))
const colors = computed(() => pptPalette(s.value))

const colorPick = reactive({
  show: false,
  left: 0,
  top: 0,
  origin: '#333333',
  kind: '',
})

function patch(partial) {
  if (props.disabled) return
  emit('update:modelValue', { ...s.value, ...partial })
}

function bind(key, map = (v) => v) {
  return computed({
    get: () => s.value[key],
    set: (v) => patch({ [key]: map(v) }),
  })
}

const paletteId = bind('paletteId')
const gradient = bind('gradient', (v) => !!v)
const font = bind('font')
const titleFont = bind('titleFont')
const radius = bind('radius')
const spacing = bind('spacing')
const showTitle = bind('showTitle', (v) => !!v)
const showFooter = bind('showFooter', (v) => !!v)
const showFootnote = bind('showFootnote', (v) => !!v)
const footnote = bind('footnote', (v) => String(v ?? ''))
const margin = bind('margin')
const titleSize = bind('titleSize', Number)
const bodySize = bind('bodySize', Number)
const capSize = bind('capSize', Number)

function palColors(p) {
  return p.id === 'custom' ? s.value.customColors : p.colors
}

function setCustomColor(i, hex) {
  const next = s.value.customColors.slice()
  next[i] = hex
  patch({ paletteId: 'custom', customColors: next })
}

function setSemantic(key, hex) {
  patch({ semantic: { ...s.value.semantic, [key]: hex } })
}

function openColor(e, kind, origin) {
  if (props.disabled) return
  const pos = placeColorPop(e.currentTarget)
  colorPick.kind = kind
  colorPick.origin = origin
  colorPick.left = pos.left
  colorPick.top = pos.top
  colorPick.show = true
}

function onColorPick(hex) {
  const k = colorPick.kind
  if (k.startsWith('custom:')) setCustomColor(Number(k.slice(7)), hex)
  else if (k.startsWith('sem:')) setSemantic(k.slice(4), hex)
  else if (k) patch({ [k]: hex })
}

const CAP_SIZES = [10, 11, 12, 13, 14, 16, 18]
</script>

<template>
  <div class="ps" :class="{ off: disabled }">
    <a-collapse v-model:active-key="openKeys" :bordered="false" expand-icon-position="right">
      <a-collapse-item key="global" header="全局样式">
        <div class="ps-body">
          <div class="ps-row ps-row-top">
            <span>图表色系</span>
            <a-select
              v-model="paletteId"
              size="small"
              :disabled="disabled"
              popup-container="body"
            >
              <a-option v-for="p in PPT_PALETTES" :key="p.id" :value="p.id" :label="p.name">
                <span class="ps-pal-opt">
                  <i v-for="c in palColors(p)" :key="c" :style="{ background: c }" />
                  <em>{{ p.name }}</em>
                </span>
              </a-option>
            </a-select>
          </div>
          <div v-if="s.paletteId === 'custom'" class="ps-row">
            <span>自定义色</span>
            <div class="ps-swatches">
              <button
                v-for="(c, i) in s.customColors"
                :key="i"
                type="button"
                class="fmt-swatch color-well"
                :style="{ background: c }"
                :disabled="disabled"
                @click.stop="openColor($event, `custom:${i}`, c)"
              />
            </div>
          </div>
          <a-checkbox v-model="gradient" :disabled="disabled" class="ps-check">渐变色彩样式</a-checkbox>
          <div class="ps-row">
            <span>语义色</span>
            <div class="ps-swatches">
              <button type="button" class="fmt-swatch color-well" title="上涨" :style="{ background: s.semantic.up }" :disabled="disabled" @click.stop="openColor($event, 'sem:up', s.semantic.up)" />
              <button type="button" class="fmt-swatch color-well" title="持平" :style="{ background: s.semantic.mid }" :disabled="disabled" @click.stop="openColor($event, 'sem:mid', s.semantic.mid)" />
              <button type="button" class="fmt-swatch color-well" title="下跌" :style="{ background: s.semantic.down }" :disabled="disabled" @click.stop="openColor($event, 'sem:down', s.semantic.down)" />
            </div>
          </div>
          <div class="ps-row">
            <span>页面字体</span>
            <PptFontSelect v-model="font" :disabled="disabled" />
          </div>
          <div class="ps-row">
            <span>圆角风格</span>
            <a-radio-group v-model="radius" size="small" :disabled="disabled">
              <a-radio value="none">无</a-radio>
              <a-radio value="sm">小</a-radio>
              <a-radio value="lg">大</a-radio>
            </a-radio-group>
          </div>
          <div class="ps-row">
            <span>间距</span>
            <a-radio-group v-model="spacing" size="small" :disabled="disabled">
              <a-radio value="compact">紧凑</a-radio>
              <a-radio value="normal">常规</a-radio>
              <a-radio value="loose">宽松</a-radio>
            </a-radio-group>
          </div>
        </div>
      </a-collapse-item>

      <a-collapse-item key="layout" header="页面布局">
        <div class="ps-body">
          <div class="ps-row">
            <span>页面信息</span>
            <div class="ps-checks">
              <a-checkbox v-model="showTitle" :disabled="disabled">标题区</a-checkbox>
              <a-checkbox v-model="showFooter" :disabled="disabled">页尾</a-checkbox>
              <a-checkbox v-model="showFootnote" :disabled="disabled">尾注</a-checkbox>
            </div>
          </div>
          <div v-if="s.showFootnote" class="ps-row">
            <span>尾注内容</span>
            <a-input
              v-model="footnote"
              size="small"
              :disabled="disabled"
              allow-clear
              placeholder="显示在图表底部，如：数据来源：Wind"
            />
          </div>
          <div class="ps-row">
            <span>页边距</span>
            <a-select v-model="margin" size="small" :disabled="disabled" popup-container="body">
              <a-option value="compact">紧凑</a-option>
              <a-option value="normal">常规</a-option>
              <a-option value="loose">宽松</a-option>
            </a-select>
          </div>
          <div class="ps-row">
            <span>内容底色</span>
            <button
              type="button"
              class="fmt-swatch color-well"
              :style="{ background: s.bodyBg || '#ffffff' }"
              :disabled="disabled"
              @click.stop="openColor($event, 'bodyBg', s.bodyBg || '#ffffff')"
            />
          </div>
        </div>
      </a-collapse-item>

      <a-collapse-item key="widget" header="组件">
        <div class="ps-body">
          <div class="ps-sub">标题</div>
          <div class="ps-toolbar">
            <PptFontSelect v-model="titleFont" :disabled="disabled" />
            <a-select v-model="titleSize" size="small" :disabled="disabled" popup-container="body" style="width: 88px">
              <a-option v-for="n in TEXT_SIZES" :key="'t' + n" :value="n">{{ n }} px</a-option>
            </a-select>
            <a-button-group size="mini">
              <a-button :type="s.titleBold ? 'primary' : 'outline'" :disabled="disabled" @click="patch({ titleBold: !s.titleBold })">B</a-button>
              <a-button class="ps-fmt-i" :type="s.titleItalic ? 'primary' : 'outline'" :disabled="disabled" @click="patch({ titleItalic: !s.titleItalic })">I</a-button>
              <a-button :type="s.titleAlign === 'left' ? 'primary' : 'outline'" :disabled="disabled" @click="patch({ titleAlign: 'left' })">左</a-button>
              <a-button :type="s.titleAlign === 'center' ? 'primary' : 'outline'" :disabled="disabled" @click="patch({ titleAlign: 'center' })">中</a-button>
              <a-button :type="s.titleAlign === 'right' ? 'primary' : 'outline'" :disabled="disabled" @click="patch({ titleAlign: 'right' })">右</a-button>
            </a-button-group>
            <button
              type="button"
              class="fmt-color color-well"
              title="标题颜色"
              :style="{ '--swatch': s.titleColor }"
              :disabled="disabled"
              @click.stop="openColor($event, 'titleColor', s.titleColor)"
            >A</button>
          </div>
          <div class="ps-sub">正文</div>
          <div class="ps-toolbar">
            <a-select v-model="bodySize" size="small" :disabled="disabled" popup-container="body" style="width: 88px">
              <a-option v-for="n in TEXT_SIZES" :key="'b' + n" :value="n">{{ n }} px</a-option>
            </a-select>
            <a-button-group size="mini">
              <a-button :type="s.bodyBold ? 'primary' : 'outline'" :disabled="disabled" @click="patch({ bodyBold: !s.bodyBold })">B</a-button>
              <a-button class="ps-fmt-i" :type="s.bodyItalic ? 'primary' : 'outline'" :disabled="disabled" @click="patch({ bodyItalic: !s.bodyItalic })">I</a-button>
            </a-button-group>
            <button
              type="button"
              class="fmt-color color-well"
              title="正文颜色"
              :style="{ '--swatch': s.bodyColor }"
              :disabled="disabled"
              @click.stop="openColor($event, 'bodyColor', s.bodyColor)"
            >A</button>
          </div>
          <div class="ps-row">
            <span>图表标题</span>
            <a-select v-model="capSize" size="small" :disabled="disabled" popup-container="body">
              <a-option v-for="n in CAP_SIZES" :key="'c' + n" :value="n">{{ n }} px</a-option>
            </a-select>
          </div>
          <div class="ps-sub">坐标轴</div>
          <div class="ps-row">
            <span>X 轴文字</span>
            <button
              type="button"
              class="fmt-color color-well"
              title="X 轴文字颜色"
              :style="{ '--swatch': s.axisXColor }"
              :disabled="disabled"
              @click.stop="openColor($event, 'axisXColor', s.axisXColor)"
            >A</button>
          </div>
          <div class="ps-row">
            <span>Y 轴文字</span>
            <button
              type="button"
              class="fmt-color color-well"
              title="Y 轴文字颜色"
              :style="{ '--swatch': s.axisYColor }"
              :disabled="disabled"
              @click.stop="openColor($event, 'axisYColor', s.axisYColor)"
            >A</button>
          </div>
        </div>
      </a-collapse-item>
    </a-collapse>

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
