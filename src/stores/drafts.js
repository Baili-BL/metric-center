import { defineStore } from 'pinia'
import { ref } from 'vue'
import { todayStr, uid } from '../utils/hash'

const LS = 'ailab.drafts.v1'

export const useDraftStore = defineStore('drafts', () => {
  let saved = []
  try { saved = JSON.parse(localStorage.getItem(LS) || '[]') } catch { saved = [] }
  const items = ref(saved.length ? saved : [
    { id: uid('R'), kind: 'task', title: '上海钢联日频同步（草稿）', date: '2026-09-16', src: '上海钢联' },
    { id: uid('R'), kind: 'task', title: '同花顺宏观补数任务', date: '2026-09-12', src: '同花顺' },
    { id: uid('R'), kind: 'calc', title: '五大材消费量环比（未保存）', date: '2026-09-10', src: '计算指标' },
  ])

  function persist() {
    try { localStorage.setItem(LS, JSON.stringify(items.value)) } catch { /* */ }
  }
  function add(payload) {
    items.value.unshift({ id: uid('R'), date: todayStr(), ...payload })
    persist()
  }
  function remove(id) {
    items.value = items.value.filter((x) => x.id !== id)
    persist()
  }

  return { items, add, remove }
})
