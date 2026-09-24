<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { Message } from '@arco-design/web-vue'
import AppModal from '../../components/AppModal.vue'
import DirPathPicker from '../../components/DirPathPicker.vue'
import Icon from '../../components/Icon.vue'
import { useIndicatorStore } from '../../stores/indicators'

const props = defineProps({ visible: Boolean })
const emit = defineEmits(['update:visible'])

const SOURCES = ['同花顺', '手工指标', 'SMM', '郑商所', '大商所', '上期所', '中金所', '上期能源', '欧洲天然气', '上海钢联']
const SOURCE_DATA = {
  同花顺: [
    ['THS10021', '沪深300指数:收盘价', '点', '日频', '2015-01-05', '2026-07-29'],
    ['THS10032', '中证500指数:收盘价', '点', '日频', '2015-01-05', '2026-07-29'],
    ['THS20415', '申万钢铁指数', '点', '日频', '2016-03-01', '2026-07-29'],
    ['THS30108', '挖掘机销量:当月值', '台', '月频', '2015-01-31', '2026-06-30'],
  ],
  手工指标: [
    ['MAN20001', '工程机械:月平均工作时长:当月值', '小时', '月频', '2019-01-31', '2026-06-30'],
    ['MAN20002', '水泥磨机开工率', '%', '周频', '2018-03-02', '2026-07-24'],
    ['MAN20003', '螺纹钢表观消费量', '万吨', '周频', '2018-01-05', '2026-07-24'],
  ],
  SMM: [
    ['SMM30011', 'SMM 1#电解铜:现货价', '元/吨', '日频', '2015-01-05', '2026-07-29'],
    ['SMM30012', 'SMM A00铝:现货价', '元/吨', '日频', '2015-01-05', '2026-07-29'],
  ],
  郑商所: [
    ['CZCE4001', '甲醇期货:主力收盘价', '元/吨', '日频', '2015-01-05', '2026-07-29'],
    ['CZCE4002', 'PTA期货:主力收盘价', '元/吨', '日频', '2015-01-05', '2026-07-29'],
  ],
  大商所: [
    ['DCE50011', '铁矿石期货:主力收盘价', '元/吨', '日频', '2015-01-05', '2026-07-29'],
    ['DCE50012', '焦炭期货:主力收盘价', '元/吨', '日频', '2015-01-05', '2026-07-29'],
  ],
  上期所: [
    ['SHFE6001', '螺纹钢期货:主力收盘价', '元/吨', '日频', '2015-01-05', '2026-07-29'],
    ['SHFE6002', '铜期货:主力收盘价', '元/吨', '日频', '2015-01-05', '2026-07-29'],
  ],
  中金所: [
    ['CFFEX7001', '沪深300股指期货:主力', '点', '日频', '2015-04-16', '2026-07-29'],
  ],
  上期能源: [
    ['INE80011', 'SC原油期货:主力收盘价', '元/桶', '日频', '2018-03-26', '2026-07-29'],
  ],
  欧洲天然气: [
    ['EUG90011', 'TTF天然气期货:结算价', '欧元/兆瓦时', '日频', '2016-01-04', '2026-07-28'],
  ],
  上海钢联: [
    ['MYS10011', '螺纹钢:HRB400E:Φ20:市场价:上海', '元/吨', '日频', '2015-01-05', '2026-07-29'],
    ['MYS10012', '热轧板卷:4.75mm:市场价:上海', '元/吨', '日频', '2015-01-05', '2026-07-29'],
    ['MYS10014', '焦炭:一级冶金焦:日照港平仓价', '元/吨', '日频', '2015-01-05', '2026-07-29'],
  ],
}

const store = useIndicatorStore()
const source = ref()
const kw = ref('')
const pick = ref(null)
const infoOpen = ref(false)
const FREQS = ['日度', '周度', '旬度', '月度', '季度', '年度']
const arcoPopup = { popupStyle: { zIndex: 5200 }, updateAtScroll: true }
const form = reactive({ name: '', dir: '', freq: '月度', unit: '' })

const rows = computed(() => {
  const q = kw.value.trim().toLowerCase()
  const list = []
  const srcs = source.value ? [source.value] : SOURCES
  srcs.forEach((s) => {
    (SOURCE_DATA[s] || []).forEach((r) => {
      const item = { id: r[0], name: r[1], unit: r[2], freq: r[3], start: r[4], end: r[5], source: s }
      if (!q || item.id.toLowerCase().includes(q) || item.name.toLowerCase().includes(q)) list.push(item)
    })
  })
  return list
})
const exist = computed(() => {
  if (!pick.value) return null
  return store.cards.find((c) => c.title === pick.value.name || c.id === pick.value.id || c.srcId === pick.value.id) || null
})

watch(() => props.visible, (v) => {
  if (!v) return
  source.value = undefined
  kw.value = ''
  pick.value = null
})

function close() { emit('update:visible', false) }
function pickRow(row) { pick.value = row }
function next() {
  if (!pick.value) return Message.warning('请先选择指标')
  if (exist.value) return Message.warning('该指标已在指标中心')
  form.name = pick.value.name
  form.dir = store.currentDir || ''
  form.freq = /日/.test(pick.value.freq) ? '日度' : /周/.test(pick.value.freq) ? '周度' : /年/.test(pick.value.freq) ? '年度' : '月度'
  form.unit = pick.value.unit
  infoOpen.value = true
}
function save() {
  if (!form.name.trim()) return Message.error('请填写指标名称')
  if (!form.dir) return Message.warning('请选择指标目录')
  const freqMap = { 日度: '日频', 周度: '周频', 旬度: '旬频', 月度: '月频', 季度: '季频', 年度: '年频' }
  store.addBase([{
    id: pick.value.id,
    title: form.name.trim(),
    unit: form.unit,
    freq: freqMap[form.freq] || '月频',
    source: pick.value.source,
    dir: form.dir,
  }])
  infoOpen.value = false
  close()
  Message.success(`已添加指标：${form.name.trim()}`)
}
</script>

<template>
  <AppModal :visible="visible" title="添加指标" icon="plus-16" size="lg" foot-end @update:visible="(v) => { if (!v) close() }">
    <div class="add-toolbar">
      <span class="tb-label">数据来源</span>
      <a-select
        v-model="source"
        class="src-arco"
        placeholder="请选择来源"
        allow-search
        popup-container="body"
        :trigger-props="arcoPopup"
        @change="pick = null"
      >
        <a-option v-for="s in SOURCES" :key="s" :value="s">{{ s }}</a-option>
      </a-select>
      <span class="spacer" />
      <span class="info-ic" title="输入指标ID可精确定位指标"><Icon name="info-fill" :size="15" /></span>
      <div class="id-search">
        <input v-model="kw" placeholder="指标ID" autocomplete="off">
        <Icon name="search" :size="13" />
      </div>
    </div>
    <div v-if="exist" class="add-warn">指标「{{ exist.title }}」已存在于指标中心，无需重复添加。</div>
    <table v-if="source || kw" class="data-table">
      <thead><tr><th style="width:160px">指标ID</th><th>起始时间</th><th>结束时间</th></tr></thead>
      <tbody>
        <tr v-for="r in rows" :key="r.id" :class="{ on: pick?.id === r.id }" @click="pickRow(r)">
          <td class="id-cell">{{ r.id }}</td>
          <td>{{ r.start }}</td>
          <td>{{ r.end }}</td>
        </tr>
        <tr v-if="!rows.length"><td colspan="3" style="color:var(--text-3)">无匹配指标</td></tr>
      </tbody>
    </table>
    <div v-else class="add-empty">请选择数据来源或输入指标ID</div>
    <template #footer>
      <button type="button" class="btn primary" :class="{ disabled: !pick || exist }" style="min-width:96px" @click="next">下一步</button>
    </template>
  </AppModal>

  <AppModal :visible="infoOpen" title="完善信息" icon="edit-fill" :width="520" overflow-visible @update:visible="(v) => { infoOpen = v }">
    <div class="ei-form">
      <div class="ei-row"><label>指标名称</label><input v-model="form.name" placeholder="请输入指标名称"></div>
      <div class="ei-row">
        <label>指标目录</label>
        <DirPathPicker v-model="form.dir" :tree="store.dirs" placeholder="请选择指标目录" />
      </div>
      <div class="ei-row">
        <label>频度</label>
        <a-select v-model="form.freq" class="app-field-select" popup-container="body" :trigger-props="arcoPopup">
          <a-option v-for="f in FREQS" :key="f" :value="f">{{ f }}</a-option>
        </a-select>
      </div>
      <div class="ei-row"><label>单位</label><input v-model="form.unit" placeholder="请输入单位"></div>
    </div>
    <template #footer>
      <button type="button" class="btn primary" style="min-width:88px" @click="save">保存</button>
      <button type="button" class="btn tint" style="min-width:88px" @click="infoOpen = false">取消</button>
    </template>
  </AppModal>
</template>
