<script setup>
import { reactive, watch } from 'vue'
import Icon from '../../components/Icon.vue'
import { defaultFmt, migrateFmtToDisplay } from '../../charts/fieldFmt'

const props = defineProps({
  visible: Boolean,
  fmt: { type: Object, default: null },
})
const emit = defineEmits(['update:visible', 'ok'])

const draft = reactive(defaultFmt())

watch(() => [props.visible, props.fmt], () => {
  if (!props.visible) return
  Object.assign(draft, migrateFmtToDisplay(props.fmt))
})

function onCurrency(e) {
  draft.currency = e.target.checked
  if (draft.currency && !draft.prefix) draft.prefix = '￥'
}

function confirm() {
  emit('ok', { ...draft, preset: 'custom' })
  emit('update:visible', false)
}

function cancel() {
  emit('update:visible', false)
}
</script>

<template>
  <a-modal
    :visible="visible"
    title="数据展示格式设置"
    :width="520"
    unmount-on-close
    @ok="confirm"
    @cancel="cancel"
    @update:visible="emit('update:visible', $event)"
  >
    <div class="axfmt-body">
      <div class="axfmt-row">
        <span class="axfmt-lab">格式类型</span>
        <div class="axfmt-ctl">
          <label class="axfmt-radio"><input type="radio" value="auto" v-model="draft.kind">自动适配</label>
          <label class="axfmt-radio"><input type="radio" value="number" v-model="draft.kind">数值</label>
          <label class="axfmt-radio"><input type="radio" value="percent" v-model="draft.kind">百分比</label>
          <label class="axfmt-radio"><input type="radio" value="manual" v-model="draft.kind">手动输入</label>
        </div>
      </div>
      <div v-if="draft.kind === 'number'" class="axfmt-row">
        <span class="axfmt-lab">数据量级</span>
        <div class="axfmt-ctl">
          <div class="axfmt-unit-wrap">
            <select class="axfmt-sel md" v-model="draft.unit">
              <option value="none">无</option>
              <option value="k">千</option>
              <option value="wan">万</option>
              <option value="m">百万</option>
              <option value="yi">亿</option>
              <option value="auto">自动</option>
            </select>
            <label class="axfmt-check"><input type="checkbox" v-model="draft.hideUnit">隐藏数据量级单位</label>
          </div>
        </div>
      </div>
      <div v-if="draft.kind === 'manual'" class="axfmt-row">
        <span class="axfmt-lab">适配方式</span>
        <div class="axfmt-ctl">
          <input class="axfmt-inp wide" v-model="draft.pattern" placeholder="#,##0" spellcheck="false">
          <span class="axfmt-help" title="常用写法：#,##0 整数千分位；#,##0.00 两位小数；0.00% 百分比">
            <Icon name="info-circle" :size="14" />
          </span>
        </div>
      </div>
      <div v-if="draft.kind !== 'auto' && draft.kind !== 'manual'" class="axfmt-row">
        <span class="axfmt-lab">小数位数</span>
        <div class="axfmt-ctl">
          <input class="axfmt-inp sm" type="number" min="0" max="6" v-model.number="draft.decimals">
        </div>
      </div>
      <div v-if="draft.kind !== 'auto' && draft.kind !== 'manual'" class="axfmt-row">
        <span class="axfmt-lab">负数</span>
        <div class="axfmt-ctl">
          <select class="axfmt-sel md" v-model="draft.neg">
            <option value="minus">-1234</option>
            <option value="paren">(1234)</option>
            <option value="trail">1234-</option>
          </select>
        </div>
      </div>
      <div v-if="draft.kind !== 'auto' && draft.kind !== 'manual'" class="axfmt-row">
        <span class="axfmt-lab">前/后缀</span>
        <div class="axfmt-ctl">
          <input class="axfmt-inp md" v-model="draft.prefix" maxlength="8" placeholder="请输入前缀">
          <span class="axfmt-slash">/</span>
          <input class="axfmt-inp md" v-model="draft.suffix" maxlength="8" placeholder="请输入后缀">
          <label v-if="draft.kind === 'number'" class="axfmt-check">
            <input type="checkbox" :checked="draft.currency" @change="onCurrency">货币符号模式
            <span class="axfmt-help" title="勾选后默认使用 ￥ 作为前缀">
              <Icon name="info-circle" :size="14" />
            </span>
          </label>
        </div>
      </div>
      <div v-if="draft.kind !== 'auto' && draft.kind !== 'manual'" class="axfmt-row">
        <span class="axfmt-lab"></span>
        <div class="axfmt-ctl">
          <label class="axfmt-check"><input type="checkbox" v-model="draft.thou">使用千分位分隔符</label>
        </div>
      </div>
    </div>
  </a-modal>
</template>
