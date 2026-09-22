<script setup>
import { computed, reactive, watch } from 'vue'
import Icon from '../../components/Icon.vue'
import { DC_AGGS, DC_OPS, defaultCond, normalizeCond, cleanCondDraft } from '../../charts/fieldFmt'

const props = defineProps({
  visible: Boolean,
  series: { type: Object, default: null },
  allSeries: { type: Array, default: () => [] },
})
const emit = defineEmits(['update:visible', 'ok'])

const draft = reactive(defaultCond())

watch(() => [props.visible, props.series], () => {
  if (!props.visible) return
  Object.assign(draft, normalizeCond(props.series?.cond ? JSON.parse(JSON.stringify(props.series.cond)) : null))
})

const isOther = computed(() => draft.where === 'other')

function setWhere(v) {
  draft.where = v === 'other' ? 'other' : 'current'
  if (draft.where === 'other') {
    const selfName = props.series?.name || ''
    const others = (props.allSeries || []).filter((x) => x.name !== selfName)
    if (!draft.groups.length || !draft.groups[0].field) {
      draft.groups = [{ field: others[0]?.name || '', rules: [] }]
    }
  } else {
    draft.groups = [{ field: '', rules: draft.groups[0] ? draft.groups[0].rules : [] }]
  }
}

function addRule(gi) {
  const g = draft.groups[gi]
  if (g) g.rules.push({ op: '>', val: '', pct: false, agg: 'avg' })
}

function delRule(gi, ri) {
  draft.groups[gi]?.rules.splice(ri, 1)
}

function noVal(op) {
  return op === 'null' || op === 'notnull'
}

function confirm() {
  emit('ok', cleanCondDraft(draft))
  emit('update:visible', false)
}

function cancel() {
  emit('update:visible', false)
}
</script>

<template>
  <a-modal
    :visible="visible"
    title="数据条件"
    :width="720"
    unmount-on-close
    @ok="confirm"
    @cancel="cancel"
    @update:visible="emit('update:visible', $event)"
  >
    <div class="dc-hint">设置数据条件后，仅满足条件的数据参与该指标的计算与展示。</div>
    <div class="fmt2-row" style="margin-bottom:12px">
      <span class="r-label" style="width:76px;text-align:right">条件对象</span>
      <select class="fmt2-sel" :value="draft.where" @change="setWhere($event.target.value)">
        <option value="current">当前指标</option>
        <option value="other">其他指标</option>
      </select>
    </div>
    <div class="dc-list">
      <template v-if="!isOther">
        <div class="dc-group">
          <div class="dc-group-head">
            <span class="g-name">当前指标</span>
            <span class="g-where">仅对图上当前指标生效</span>
          </div>
          <button type="button" class="dc-add" @click="addRule(0)">+ 添加条件</button>
          <div class="dc-rows">
            <div v-if="!draft.groups[0]?.rules?.length" class="dc-empty">暂无条件，点击上方「添加条件」</div>
            <template v-for="(r, ri) in (draft.groups[0]?.rules || [])" :key="ri">
              <div v-if="ri > 0" class="dc-row dc-and">且</div>
              <div class="dc-row">
                <select class="dc-op" v-model="r.op">
                  <option v-for="o in DC_OPS" :key="o.v" :value="o.v">{{ o.t }}</option>
                </select>
                <input class="dc-val" type="number" step="any" placeholder="数值" v-model="r.val" :disabled="noVal(r.op)">
                <select class="dc-pct" :value="r.pct ? '1' : '0'" :disabled="noVal(r.op)" @change="r.pct = $event.target.value === '1'">
                  <option value="0">值</option>
                  <option value="1">%</option>
                </select>
                <button type="button" class="dc-del" title="删除" @click="delRule(0, ri)">
                  <Icon name="trash-fill" :size="12" />
                </button>
              </div>
            </template>
          </div>
        </div>
      </template>
      <template v-else>
        <div v-for="(g, gi) in draft.groups" :key="gi" class="dc-group">
          <div class="dc-group-head">
            <span class="g-sw" :style="{ background: (allSeries.find(s => s.name === g.field)?.color) || '#c4c8cf' }"></span>
            <select class="dc-field" v-model="g.field">
              <option value="">选择字段</option>
              <option v-for="s in allSeries" :key="s.name" :value="s.name">{{ s.alias || s.name }}</option>
            </select>
            <span class="g-where">组内条件为「且」</span>
          </div>
          <button type="button" class="dc-add" @click="addRule(gi)">+ 添加条件</button>
          <div class="dc-rows">
            <div v-if="!g.rules.length" class="dc-empty">暂无条件，点击上方「添加条件」</div>
            <template v-for="(r, ri) in g.rules" :key="ri">
              <div v-if="ri > 0" class="dc-row dc-and">且</div>
              <div class="dc-row">
                <select class="dc-op" v-model="r.op">
                  <option v-for="o in DC_OPS" :key="o.v" :value="o.v">{{ o.t }}</option>
                </select>
                <input class="dc-val" type="number" step="any" placeholder="数值" v-model="r.val" :disabled="noVal(r.op)">
                <select class="dc-pct" :value="r.pct ? '1' : '0'" :disabled="noVal(r.op)" @change="r.pct = $event.target.value === '1'">
                  <option value="0">值</option>
                  <option value="1">%</option>
                </select>
                <select class="dc-agg" v-model="r.agg">
                  <option v-for="it in DC_AGGS" :key="it[0]" :value="it[0]">{{ it[1] }}</option>
                </select>
                <button type="button" class="dc-del" title="删除" @click="delRule(gi, ri)">
                  <Icon name="trash-fill" :size="12" />
                </button>
              </div>
            </template>
          </div>
        </div>
      </template>
    </div>
  </a-modal>
</template>
