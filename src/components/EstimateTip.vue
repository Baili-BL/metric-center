<script setup>
/**
 * 估算参数说明提示（统一口径文案）
 * 使用场景：某公司昨日/明日在前 20 榜单而今日不在时，按参数 × 榜单末位仓位估算
 */
</script>

<template>
  <a-tooltip position="br">
    <icon-info-circle class="est-tip-ico" />
    <template #content>
      <div class="est-tip">
        <p class="est-tip-h">1. 使用场景</p>
        <p>某一个期货公司昨天（T-1日）在前 20 多空榜上，但今天（T日）不在榜上时，用于估算今天的仓位 = 估算参数 × 榜单最后一名的仓位。</p>
        <p>某一个期货公司第二天（T+1日）在前 20 多空榜上，但今天（T日）不在榜上时，用于估算今天的仓位 = 估算参数 × 榜单最后一名的仓位。</p>
        <p class="est-tip-h">2. 参数可调节范围：0-1，含 0 和 1</p>
      </div>
    </template>
  </a-tooltip>
</template>

<style scoped>
.est-tip {
  max-width: 380px;
  font-size: 12px;
  line-height: 1.7;
}
.est-tip p { margin: 0 0 6px; }
.est-tip p:last-child { margin-bottom: 0; }
.est-tip .est-tip-h { font-weight: 600; margin-bottom: 6px; }
.est-tip-ico { color: #a0a1a7; cursor: help; }
</style>
