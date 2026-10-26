<script setup>
import { useRouter } from 'vue-router'
import Icon from '../../components/Icon.vue'

const router = useRouter()
const planned = ['告警规则引擎（阈值 / 环比 / 连续下行）', '飞书 · 钉钉 · 邮件 · 短信通知', '告警确认与恢复流转', '告警趋势与值班统计', '与指标中心联动监控']
</script>

<template>
  <section class="dh-page">
    <div class="dh-page-head">
      <div>
        <h1>告警中心 <span class="dh-tag orange" style="vertical-align: 4px; margin-left: 8px">规划中</span></h1>
        <div class="dh-sub">指标异动监控与多渠道告警触达中心</div>
      </div>
    </div>

    <div class="ph-card">
      <div class="ph-ico"><Icon name="nav-alert" :size="30" /></div>
      <h2>告警中心正在规划中</h2>
      <p class="ph-desc">
        中心建成后可对指标中心的关键指标配置阈值与异动规则，通过多渠道实时触达，
        告警处理记录全程留痕，支持与数据采集任务异常联动。
      </p>
      <div class="ph-chips">
        <span v-for="p in planned" :key="p" class="dh-tag gray">{{ p }}</span>
      </div>
      <div class="ph-actions">
        <a-button type="primary" @click="router.push('/overview')">返回平台总览</a-button>
        <a-button @click="router.push('/indicators')">先去浏览指标中心</a-button>
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
  background: linear-gradient(135deg, #ffa940, #ff8a00);
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
