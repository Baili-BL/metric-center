<script setup>
import { useRouter } from 'vue-router'
import Icon from '../../components/Icon.vue'

const router = useRouter()
const planned = ['采集任务与调度管理', '目标站点与解析规则配置', '抓取数据自动入库', '运行日志与失败重试', '抓取量与成功率监控']
</script>

<template>
  <section class="dh-page">
    <div class="dh-page-head">
      <div>
        <h1>数据采集 <span class="dh-tag orange" style="vertical-align: 4px; margin-left: 8px">规划中</span></h1>
        <div class="dh-sub">面向投研数据采集的统一调度与监控中心</div>
      </div>
    </div>

    <div class="ph-card">
      <div class="ph-ico"><Icon name="nav-crawler" :size="30" /></div>
      <h2>数据采集中心正在规划中</h2>
      <p class="ph-desc">
        中心建成后将与指标中心打通：采集数据一键生成指标、自动进入数据源管理，
        并支持调度日志与告警中心联动。
      </p>
      <div class="ph-chips">
        <span v-for="p in planned" :key="p" class="dh-tag gray">{{ p }}</span>
      </div>
      <div class="ph-actions">
        <a-button type="primary" @click="router.push('/overview')">返回平台总览</a-button>
        <a-button @click="router.push('/datasource')">先去配置数据源</a-button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.ph-card {
  background: #fff;
  border: 1px solid var(--dh-border);
  border-radius: 10px;
  padding: 64px 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}
.ph-ico {
  width: 64px;
  height: 64px;
  border-radius: 16px;
  background: linear-gradient(135deg, #9a85ff, #7861ff);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 18px;
}
.ph-card h2 { margin: 0; font-size: 18px; font-weight: 600; color: var(--dh-text); }
.ph-desc {
  margin: 10px 0 0;
  max-width: 460px;
  font-size: 13px;
  line-height: 1.7;
  color: var(--dh-text-3);
}
.ph-chips { margin-top: 18px; display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }
.ph-actions { margin-top: 26px; display: flex; gap: 10px; }
</style>
