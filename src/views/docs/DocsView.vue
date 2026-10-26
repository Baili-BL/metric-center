<script setup>
import { computed, ref } from 'vue'
import { Message } from '@arco-design/web-vue'

/* 文档中心：顶部 tab 对接不同平台的文档（demo） */
const TABS = [
  { key: 'general', label: '通用文档' },
  { key: 'ind', label: '指标中心' },
  { key: 'crawler', label: '数据采集' },
  { key: 'alerts', label: '告警中心' },
]

// 代码示例：每行一段 HTML（tk-kw 关键字 / tk-str 字符串 / tk-cm 注释 / tk-fn 函数）
const CODE = {
  curlTask: [
    '<span class="tk-cm"># 创建一个每日 08:00 的 LME 行情采集任务</span>',
    '<span class="tk-fn">curl</span> -X POST https://datahub.example.com/api/v1/crawler/tasks \\',
    '  -H <span class="tk-str">"Authorization: Bearer &lt;token&gt;"</span> \\',
    '  -H <span class="tk-str">"Content-Type: application/json"</span> \\',
    '  -d <span class="tk-str">\'{ "name": "LME 金属现货日度行情", "type": "api", "cron": "0 8 * * *" }\'</span>',
  ],
  alertRule: [
    '{',
    '  <span class="tk-kw">"rule"</span>: <span class="tk-str">"螺纹钢库存超预期累积"</span>,',
    '  <span class="tk-kw">"metric"</span>: <span class="tk-str">"五大材库存:螺纹钢"</span>,',
    '  <span class="tk-kw">"cond"</span>: <span class="tk-str">"wow_up"</span>,  <span class="tk-cm">// 周环比涨幅</span>',
    '  <span class="tk-kw">"threshold"</span>: <span class="tk-str">"2%"</span>,',
    '  <span class="tk-kw">"level"</span>: <span class="tk-str">"P0"</span>,',
    '  <span class="tk-kw">"channels"</span>: [<span class="tk-str">"feishu"</span>, <span class="tk-str">"sms"</span>]',
    '}',
  ],
  sqlQuery: [
    '<span class="tk-kw">SELECT</span> trade_date, metal, spot_price, change_pct',
    '<span class="tk-kw">FROM</span> dwd_lme_spot_daily',
    '<span class="tk-kw">WHERE</span> trade_date = <span class="tk-str">\'2026-10-25\'</span>',
    '<span class="tk-kw">ORDER BY</span> metal;',
  ],
  indCalc: [
    '{',
    '  <span class="tk-kw">"name"</span>: <span class="tk-str">"螺纹钢库存周环比"</span>,',
    '  <span class="tk-kw">"base"</span>: [<span class="tk-str">"五大材库存:螺纹钢"</span>],',
    '  <span class="tk-kw">"calc"</span>: <span class="tk-str">"(cur - prev) / prev * 100"</span>,',
    '  <span class="tk-kw">"freq"</span>: <span class="tk-str">"周"</span>,',
    '  <span class="tk-kw">"unit"</span>: <span class="tk-str">"%"</span>',
    '}',
  ],
  crawlerCron: [
    '{',
    '  <span class="tk-kw">"schedule"</span>: <span class="tk-str">"0 */30 * * * *"</span>,  <span class="tk-cm">// 每 30 分钟</span>',
    '  <span class="tk-kw">"retry"</span>: { <span class="tk-kw">"max"</span>: 3, <span class="tk-kw">"backoff"</span>: <span class="tk-str">"exponential"</span> },',
    '  <span class="tk-kw">"timeout"</span>: 90,',
    '  <span class="tk-kw">"onFail"</span>: <span class="tk-str">"alert:P0"</span>',
    '}',
  ],
  alertChannel: [
    '{',
    '  <span class="tk-kw">"feishu"</span>: { <span class="tk-kw">"webhook"</span>: <span class="tk-str">"https://open.feishu.cn/…"</span>, <span class="tk-kw">"at"</span>: [<span class="tk-str">"值班人"</span>] },',
    '  <span class="tk-kw">"sms"</span>: { <span class="tk-kw">"template"</span>: <span class="tk-str">"DH_ALERT_P0"</span>, <span class="tk-kw">"to"</span>: <span class="tk-str">"值班手机组"</span> },',
    '  <span class="tk-kw">"silence"</span>: <span class="tk-str">"1h"</span>',
    '}',
  ],
}

const DOCS = {
  general: {
    crumb: '文档 / 快速开始 / 数据接入指南',
    title: '数据接入指南',
    meta: ['最后更新 2026-10-20', '阅读约 6 分钟', '维护人 吴开文'],
    lead: '本指南介绍如何将外部行情、库存与宏观数据接入 DataHub：通过「数据采集」创建采集任务，数据自动清洗入库，再在「指标中心」将数据字段一键生成指标，供图库、表格与智能PPT使用。',
    tip: { b: '开始之前', p: '请先在「数据源」中完成上海钢联 / 同花顺 / SMM 的账号授权；未完成授权的采集任务将无法通过连通性校验。' },
    nav: [
      { group: '快速开始', items: ['产品简介', '数据接入指南', '指标建模'] },
      { group: '开发指南', items: ['API 概览', 'Webhook 事件', 'SDK 下载'] },
      { group: '附录', items: ['更新日志', '常见问题'] },
    ],
    sections: [
      { id: 's1', h2: '一、创建采集任务', paras: ['进入「数据采集 → 采集任务 → 新建任务」，填写任务名称、目标 URL 并选择采集类型与调度频率。任务创建后默认为暂停状态，可在列表中手动运行或恢复调度。'], code: { lang: 'bash', lines: CODE.curlTask } },
      { id: 's2', h2: '二、配置告警规则', paras: ['在「告警中心 → 告警规则」中为关键指标设置异动规则。规则支持阈值、环比涨跌幅与连续下行三类条件，触发后按所选渠道推送，处理过程全程留痕。'], code: { lang: 'json', lines: CODE.alertRule } },
      { id: 's3', h2: '三、验证数据入库', paras: ['任务运行成功后，在「采集任务 → 抓取数据」中预览入库结果；也可通过指标管理将数据字段保存为指标。'], code: { lang: 'sql', lines: CODE.sqlQuery } },
      { id: 's4', h2: '调度频率说明', paras: ['不同场景应选择合适的调度频率，避免无效高频抓取对目标站点造成压力。'], table: [['频率', '说明', '适用场景'], ['每 30 分钟', '高频轮询，适合盘中报价', '现货报价、舆情监控'], ['每日固定时刻', '收盘后批量抓取', '日度行情、库存周报'], ['每月固定日期', '月度数据发布后抓取', '宏观指标、进出口月报'], ['手动触发', '不参与自动调度', '临时补数、一次性任务']] },
    ],
  },
  ind: {
    crumb: '文档 / 指标中心 / 使用手册',
    title: '指标中心使用手册',
    meta: ['最后更新 2026-10-18', '阅读约 5 分钟', '维护人 王数'],
    lead: '指标中心是 DataHub 的数据语义层：将入库数据字段定义为可复用的指标，支持基础指标与计算指标两类，并通过目录树与权限体系沉淀为团队资产。',
    tip: { b: '命名建议', p: '指标名称建议使用「对象 + 口径 + 频率」结构，例如：螺纹钢库存周环比；同名指标在不同目录允许并存，但需在描述中写清口径差异。' },
    nav: [
      { group: '使用手册', items: ['功能概览', '指标管理', '计算指标'] },
      { group: '最佳实践', items: ['命名规范', '目录规划'] },
    ],
    sections: [
      { id: 's1', h2: '一、指标目录与检索', paras: ['左侧目录树按业务域组织指标，支持关键词搜索与精确匹配；点击指标进入详情页可查看口径、频度、最近数据与图表预览。'] },
      { id: 's2', h2: '二、计算指标建模', paras: ['计算指标基于已有基础指标通过表达式派生，支持四则运算、同比环比与移动平均。'], code: { lang: 'json', lines: CODE.indCalc } },
      { id: 's3', h2: '三、权限与协作', paras: ['目录支持按角色授权（可见 / 可编辑 / 可管理），被授权成员可在图库与表格中直接引用指标；所有变更记录在草稿箱中可回溯。'] },
    ],
  },
  crawler: {
    crumb: '文档 / 数据采集 / 配置手册',
    title: '采集任务配置手册',
    meta: ['最后更新 2026-10-15', '阅读约 7 分钟', '维护人 李研'],
    lead: '采集任务负责把目标站点的数据定时抓取入库。任务由「目标 + 解析规则 + 调度策略」三部分组成，支持 API 接口、列表页解析、详情页解析与文件下载四类采集方式。',
    tip: { b: '站点礼仪', p: '请合理设置调度频率并遵守目标站点 robots 协议；高频抓取触发反爬会导致任务异常与 IP 封禁。' },
    nav: [
      { group: '配置指南', items: ['任务类型', '调度策略', '解析规则'] },
      { group: '运维', items: ['监控告警', '失败排查'] },
    ],
    sections: [
      { id: 's1', h2: '一、任务类型与选择', paras: ['API 接口：目标站提供结构化接口时优先使用；列表页解析：适用于行情列表、报价页；详情页解析：用于抽取单页深层数据；文件下载：月报 PDF / Excel 附件类。'] },
      { id: 's2', h2: '二、调度与重试策略', paras: ['调度基于 cron 表达式，失败自动重试并按指数退避；连续失败达到阈值将触发告警中心 P0 通知。'], code: { lang: 'json', lines: CODE.crawlerCron } },
      { id: 's3', h2: '三、数据清洗与入库', paras: ['抓取结果经过字段映射、单位归一与去重后写入数据集；可在「抓取数据」页预览样本行，入库记录保留完整 lineage。'] },
    ],
  },
  alerts: {
    crumb: '文档 / 告警中心 / 配置手册',
    title: '告警规则配置手册',
    meta: ['最后更新 2026-10-12', '阅读约 5 分钟', '维护人 赵策'],
    lead: '告警中心对指标异动进行持续监控：规则由「监控指标 + 触发条件 + 级别 + 通知渠道」构成，支持静默期与值班升级策略，避免告警风暴。',
    nav: [
      { group: '配置指南', items: ['规则类型', '级别定义'] },
      { group: '触达', items: ['渠道配置', '值班排班'] },
    ],
    sections: [
      { id: 's1', h2: '一、规则类型与级别', paras: ['阈值：指标越过固定值；环比：涨跌幅超过阈值；连续下行：连续 N 期同向变动。级别分 P0（严重，需立即处理）、P1（重要）、P2（提示）。'] },
      { id: 's2', h2: '二、通知渠道配置', paras: ['渠道支持飞书、钉钉、邮件、短信与 Webhook 回调，可按级别组合启用，P0 建议叠加短信。'], code: { lang: 'json', lines: CODE.alertChannel } },
      { id: 's3', h2: '三、值班与静默', paras: ['同一规则在静默期内不重复触达；P0 告警未确认将按排班逐级升级，处理动作（确认 / 恢复）全程留痕。'] },
    ],
  },
}

const activeTab = ref('general')
const doc = computed(() => DOCS[activeTab.value])
function navClick() {
  Message.info('示例文档（demo）· 内容建设中')
}
</script>

<template>
  <div class="docs-page">
    <!-- 文档顶部 tab：对接不同平台的文档 -->
    <nav class="docs-topbar">
      <button
        v-for="t in TABS"
        :key="t.key"
        class="docs-tab"
        :class="{ on: activeTab === t.key }"
        @click="activeTab = t.key"
      >
        {{ t.label }}
      </button>
    </nav>

    <div class="docs-body">
      <!-- 左侧文档树 -->
      <aside class="docs-nav">
        <div v-for="g in doc.nav" :key="g.group" class="dn-group">
          <div class="dn-group-title">{{ g.group }}</div>
          <button
            v-for="(it, i) in g.items"
            :key="it"
            class="dn-item"
            :class="{ on: i === 0 && g === doc.nav[0] }"
            @click="navClick()"
          >
            {{ it }}
          </button>
        </div>
      </aside>

      <!-- 正文 -->
      <article class="docs-main">
        <div class="docs-crumb">{{ doc.crumb }}</div>
        <h1 class="docs-h1">{{ doc.title }}</h1>
        <div class="docs-meta">
          <span v-for="m in doc.meta" :key="m">{{ m }}</span>
        </div>

        <p class="docs-lead">{{ doc.lead }}</p>

        <div v-if="doc.tip" class="docs-tip">
          <span class="tip-ico">💡</span>
          <div>
            <b>{{ doc.tip.b }}</b>
            <p>{{ doc.tip.p }}</p>
          </div>
        </div>

        <template v-for="s in doc.sections" :key="s.id">
          <h2 :id="s.id">{{ s.h2 }}</h2>
          <p v-for="(p, i) in s.paras" :key="i">{{ p }}</p>
          <pre v-if="s.code" class="docs-code"><code><div v-for="(ln, li) in s.code.lines" :key="li" class="cl" v-html="ln" /></code></pre>
          <div v-if="s.table" class="docs-table-wrap">
            <table class="docs-table">
              <thead><tr><th v-for="h in s.table[0]" :key="h">{{ h }}</th></tr></thead>
              <tbody>
                <tr v-for="(row, ri) in s.table.slice(1)" :key="ri">
                  <td v-for="cell in row" :key="cell">{{ cell }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>

        <div class="docs-pager">
          <button class="pg-item" @click="navClick()"><span>上一篇</span><b>{{ doc.nav[0].items[0] }}</b></button>
          <button class="pg-item next" @click="navClick()"><span>下一篇</span><b>{{ doc.nav[0].items[1] || doc.nav[1].items[0] }}</b></button>
        </div>
      </article>

      <!-- 右侧本页目录 -->
      <aside class="docs-toc">
        <div class="toc-title">本页目录</div>
        <a v-for="s in doc.sections" :key="s.id" class="toc-item" :href="'#' + s.id">{{ s.h2 }}</a>
      </aside>
    </div>
  </div>
</template>
