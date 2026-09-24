<script setup>
import { computed } from 'vue'
import Icon from '../../components/Icon.vue'
import { crossBarTimeLabel, latestYmd, monthStartYmd } from '../../charts/types'

const props = defineProps({
  modelValue: { type: Object, required: true },
  labels: { type: Array, default: () => [] },
})

const cfg = computed(() => props.modelValue)
const hint = computed(() => crossBarTimeLabel(cfg.value, props.labels))
const minDate = computed(() => monthStartYmd(props.labels[0] || '2019-01'))
const maxDate = computed(() => latestYmd(props.labels))

function bindDate(point, key, fallback) {
  return point[key] || fallback
}

function setDate(point, keys, value) {
  const v = value || ''
  keys.forEach((k) => { point[k] = v })
}

function toYmd(current) {
  if (!current) return ''
  if (typeof current.format === 'function') return current.format('YYYY-MM-DD')
  const d = current instanceof Date ? current : new Date(current)
  if (Number.isNaN(+d)) {
    const s = String(current)
    return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : ''
  }
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function disabledDate(current) {
  if (!current) return false
  const ymd = toYmd(current)
  if (!ymd) return false
  return ymd < minDate.value || ymd > maxDate.value
}
</script>

<template>
  <div class="cross-time">
    <div class="cb-filter-row">
      <span class="cb-filter-label">筛选方式</span>
      <label><input type="radio" value="day" v-model="cfg.filter">单日</label>
      <label><input type="radio" value="range" v-model="cfg.filter">日区间</label>
    </div>

    <div v-if="cfg.filter === 'day'" class="cb-pane">
      <div class="cb-day-editor">
        <span class="cb-day-lab">时间类型</span>
        <div class="cb-day-body">
          <div class="cb-day-type-line">
            <div class="cb-day-type-wrap">
              <select class="cb-day-type" v-model="cfg.day.type">
                <option value="relative">相对时间</option>
                <option value="precise">精确时间</option>
              </select>
            </div>
            <div v-if="cfg.day.type === 'relative'" class="cb-day-base-wrap">
              <span class="cb-t-ico is-base" title="基准日"><Icon name="time-t-base" :size="14" /></span>
              <div class="cb-date-field">
                <a-date-picker
                  class="cb-date-picker"
                  size="mini"
                  value-format="YYYY-MM-DD"
                  placeholder="请选择日期"
                  popup-container="body"
                  :allow-clear="false"
                  :model-value="bindDate(cfg.day, 'base', maxDate)"
                  :disabled-date="disabledDate"
                  @update:model-value="setDate(cfg.day, ['base'], $event)"
                />
              </div>
            </div>
          </div>
          <div v-if="cfg.day.type === 'relative'" class="cb-day-rel">
            <span class="cb-t-ico" title="相对偏移"><Icon name="time-t" :size="14" /></span>
            <select class="cb-unit" v-model="cfg.day.unit">
              <option value="day">日</option>
              <option value="month">月</option>
              <option value="year">年</option>
            </select>
            <select class="cb-op" v-model="cfg.day.op">
              <option value="-">-</option>
              <option value="+">+</option>
            </select>
            <input class="cb-off" type="number" min="0" max="3650" v-model.number="cfg.day.offset" placeholder="">
          </div>
          <div v-else class="cb-day-precise">
            <div class="cb-date-field">
              <a-date-picker
                class="cb-date-picker"
                size="mini"
                value-format="YYYY-MM-DD"
                placeholder="请选择日期"
                popup-container="body"
                :allow-clear="false"
                :model-value="bindDate(cfg.day, 'date', maxDate)"
                :disabled-date="disabledDate"
                @update:model-value="setDate(cfg.day, ['date'], $event)"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="cb-pane">
      <div class="cb-filter-row">
        <span class="cb-filter-label">区间类型</span>
        <label><input type="radio" value="start" v-model="cfg.rangeKind">开始于</label>
        <label><input type="radio" value="end" v-model="cfg.rangeKind">结束于</label>
        <label><input type="radio" value="span" v-model="cfg.rangeKind">时间区间</label>
      </div>
      <div class="cb-range-cols">
        <div v-if="cfg.rangeKind !== 'end'" class="cb-bound cb-day-editor">
          <span class="cb-day-lab">开始于</span>
          <div class="cb-day-body">
            <div class="cb-day-type-line">
              <div class="cb-day-type-wrap">
                <select class="cb-day-type" v-model="cfg.start.type">
                  <option value="relative">相对时间</option>
                  <option value="precise">精确时间</option>
                </select>
              </div>
              <div v-if="cfg.start.type === 'relative'" class="cb-day-base-wrap">
                <span class="cb-t-ico is-base" title="基准日"><Icon name="time-t-base" :size="14" /></span>
                <div class="cb-date-field">
                  <a-date-picker
                    class="cb-date-picker"
                    size="mini"
                    value-format="YYYY-MM-DD"
                    placeholder="请选择日期"
                    popup-container="body"
                    :allow-clear="false"
                    :model-value="bindDate(cfg.start, 'date', minDate)"
                    :disabled-date="disabledDate"
                    @update:model-value="setDate(cfg.start, ['date', 'base'], $event)"
                  />
                </div>
              </div>
            </div>
            <div v-if="cfg.start.type === 'relative'" class="cb-day-rel">
              <span class="cb-t-ico" title="相对偏移"><Icon name="time-t" :size="14" /></span>
              <select class="cb-unit" v-model="cfg.start.unit">
                <option value="day">日</option>
                <option value="month">月</option>
                <option value="year">年</option>
              </select>
              <select class="cb-op" v-model="cfg.start.op">
                <option value="-">-</option>
                <option value="+">+</option>
              </select>
              <input class="cb-off" type="number" min="0" max="3650" v-model.number="cfg.start.offset">
            </div>
            <div v-else class="cb-day-precise">
              <div class="cb-date-field">
                <a-date-picker
                  class="cb-date-picker"
                  size="mini"
                  value-format="YYYY-MM-DD"
                  placeholder="请选择日期"
                  popup-container="body"
                  :allow-clear="false"
                  :model-value="bindDate(cfg.start, 'date', minDate)"
                  :disabled-date="disabledDate"
                  @update:model-value="setDate(cfg.start, ['date'], $event)"
                />
              </div>
            </div>
          </div>
        </div>
        <div v-if="cfg.rangeKind !== 'start'" class="cb-bound cb-day-editor">
          <span class="cb-day-lab">结束于</span>
          <div class="cb-day-body">
            <div class="cb-day-type-line">
              <div class="cb-day-type-wrap">
                <select class="cb-day-type" v-model="cfg.end.type">
                  <option value="relative">相对时间</option>
                  <option value="precise">精确时间</option>
                </select>
              </div>
              <div v-if="cfg.end.type === 'relative'" class="cb-day-base-wrap">
                <span class="cb-t-ico is-base" title="基准日"><Icon name="time-t-base" :size="14" /></span>
                <div class="cb-date-field">
                  <a-date-picker
                    class="cb-date-picker"
                    size="mini"
                    value-format="YYYY-MM-DD"
                    placeholder="请选择日期"
                    popup-container="body"
                    :allow-clear="false"
                    :model-value="bindDate(cfg.end, 'date', maxDate)"
                    :disabled-date="disabledDate"
                    @update:model-value="setDate(cfg.end, ['date', 'base'], $event)"
                  />
                </div>
              </div>
            </div>
            <div v-if="cfg.end.type === 'relative'" class="cb-day-rel">
              <span class="cb-t-ico" title="相对偏移"><Icon name="time-t" :size="14" /></span>
              <select class="cb-unit" v-model="cfg.end.unit">
                <option value="day">日</option>
                <option value="month">月</option>
                <option value="year">年</option>
              </select>
              <select class="cb-op" v-model="cfg.end.op">
                <option value="-">-</option>
                <option value="+">+</option>
              </select>
              <input class="cb-off" type="number" min="0" max="3650" v-model.number="cfg.end.offset">
            </div>
            <div v-else class="cb-day-precise">
              <div class="cb-date-field">
                <a-date-picker
                  class="cb-date-picker"
                  size="mini"
                  value-format="YYYY-MM-DD"
                  placeholder="请选择日期"
                  popup-container="body"
                  :allow-clear="false"
                  :model-value="bindDate(cfg.end, 'date', maxDate)"
                  :disabled-date="disabledDate"
                  @update:model-value="setDate(cfg.end, ['date'], $event)"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="cross-time-hint">取值时间：{{ hint }}</div>
  </div>
</template>
