<script setup>
// 混合表共享面板：日期来源（指标最新日期/系统日期/表格日期/手动输入）+ 期数前移 + 叠加式日期变换
// cfg 为父组件传入的 reactive 对象，直接原地修改；@pick 用于"从表格选格"拾取单元格引用
import { ref } from 'vue'
import { ANCHOR_OPTS } from '../utils/mixed'

const props = defineProps({
  cfg: { type: Object, required: true },
  needInd: { type: Boolean, default: false }, // 导入日期弹窗需要额外显示指标选择器（由父级渲染，这里只控制占位）
})
const emit = defineEmits(['pick'])

const addOpen = ref(false)
function addShift() {
  props.cfg.transforms.push({ type: 'shift', unit: 'day', n: -5 })
  addOpen.value = false
}
function addAnchor() {
  props.cfg.transforms.push({ type: 'anchor', anchor: 'monday' })
  addOpen.value = false
}
function delTf(i) {
  props.cfg.transforms.splice(i, 1)
}
</script>

<template>
  <div class="mx-dp">
    <div class="mx-row">
      <select v-model="cfg.src" class="mx-select">
        <option value="indLatest">指标最新日期</option>
        <option value="system">系统日期</option>
        <option value="cell">表格日期（单元格）</option>
        <option value="manual">手动输入日期</option>
      </select>
      <template v-if="cfg.src === 'indLatest'">
        <span class="mx-unit">期数前移</span>
        <input v-model.number="cfg.back" type="number" min="0" class="mx-num" title="前移期数：0=最新日期，1=上一期">
        <span class="mx-unit">期</span>
      </template>
      <template v-else-if="cfg.src === 'cell'">
        <input v-model="cfg.cellRef" class="mx-ref" placeholder="单元格引用，如 B3">
        <button type="button" class="mx-pick-btn" title="点击后在表格中点选一个日期单元格" @click="emit('pick')">选格</button>
      </template>
      <template v-else-if="cfg.src === 'manual'">
        <input v-model="cfg.manual" class="mx-ref" placeholder="如 2026-01-29 或 1/29">
      </template>
    </div>

    <div class="mx-row" style="margin-top:6px; align-items:flex-start">
      <span class="mx-unit" style="line-height:26px">日期变换</span>
      <div class="mx-tf-stack">
        <div v-if="!cfg.transforms.length" class="mx-tf-empty">无（可在下方添加位移或锚定，按添加顺序叠加计算）</div>
        <div v-for="(t, i) in cfg.transforms" :key="i" class="mx-tf-item">
          <span class="mx-tf-order">{{ i + 1 }}</span>
          <template v-if="t.type === 'shift'">
            <input v-model.number="t.n" type="number" class="mx-num" title="正数后移、负数前移">
            <select v-model="t.unit" class="mx-select" style="width:64px">
              <option value="day">天</option>
              <option value="week">周</option>
              <option value="month">月</option>
            </select>
            <span class="mx-unit">位移</span>
          </template>
          <template v-else>
            <span class="mx-unit">指定频率</span>
            <select v-model="t.anchor" class="mx-select" style="flex:1">
              <option value="monday">所在周周一</option>
              <option value="monthStart">所在月月初</option>
              <option value="monthEnd">所在月月末</option>
              <option value="prevMonthSameDay">上月同期</option>
              <option value="prevYearSameDay">上年同期</option>
            </select>
          </template>
          <button type="button" class="mx-tf-del" title="删除该变换" @click="delTf(i)">×</button>
        </div>
        <div class="mx-tf-add-wrap">
          <button type="button" class="mx-tf-add" @click.stop="addOpen = !addOpen">＋ 添加变换</button>
          <div v-show="addOpen" class="mx-tf-add-menu" @mouseleave="addOpen = false">
            <button type="button" @click="addShift">日期位移（±天/周/月）</button>
            <button type="button" @click="addAnchor">指定频率（锚定到周/月/同期）</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mx-dp { width: 100%; }
.mx-tf-stack {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  border: 1px dashed var(--border, #d0d3d9);
  border-radius: 6px;
  padding: 6px;
  min-width: 0;
}
.mx-tf-empty { font-size: 11px; color: var(--text-3, #9aa0a8); line-height: 1.5; }
.mx-tf-item { display: flex; align-items: center; gap: 5px; }
.mx-tf-order {
  width: 16px; height: 16px; border-radius: 50%;
  background: var(--primary-6, #165dff); color: #fff;
  font-size: 10px; display: inline-flex; align-items: center; justify-content: center;
  flex: none;
}
.mx-tf-del {
  border: none; background: transparent; color: var(--text-3, #9aa0a8);
  cursor: pointer; font-size: 14px; padding: 0 4px; line-height: 1;
}
.mx-tf-del:hover { color: #d5304f; }
.mx-tf-add-wrap { position: relative; margin-top: 2px; }
.mx-tf-add {
  border: 1px dashed var(--border, #d0d3d9); background: transparent; color: var(--text-2, #4e5969);
  font-size: 11px; border-radius: 4px; padding: 2px 8px; cursor: pointer;
}
.mx-tf-add:hover { color: var(--primary-6, #165dff); border-color: var(--primary-6, #165dff); }
.mx-tf-add-menu {
  position: absolute; left: 0; bottom: 100%; margin-bottom: 4px; z-index: 40;
  background: var(--bg-2, #fff); border: 1px solid var(--border, #e0e3e8); border-radius: 8px;
  box-shadow: 0 6px 20px rgba(0,0,0,.1); padding: 4px; min-width: 210px;
}
.mx-tf-add-menu button {
  display: block; width: 100%; text-align: left; border: none; background: transparent;
  font-size: 12px; color: var(--text-1, #1d2129); padding: 6px 10px; border-radius: 5px; cursor: pointer;
}
.mx-tf-add-menu button:hover { background: var(--fill-2, #f2f3f5); }
.mx-pick-btn {
  border: 1px solid var(--border, #d0d3d9); background: var(--bg-2, #fff); color: var(--text-2, #4e5969);
  font-size: 11px; border-radius: 4px; padding: 4px 8px; cursor: pointer; flex: none;
}
.mx-pick-btn:hover { color: var(--primary-6, #165dff); border-color: var(--primary-6, #165dff); }
</style>
