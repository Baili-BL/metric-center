/** ESM export of Label Adapter Engine */
const LabelAdapter = (function () {
  "use strict";

  var DEFAULT_STRATEGIES = ["sampling", "hiding", "rotating", "wrapping", "ellipsis"];
  var DEFAULT_OPTIONS = {
    samplingThreshold: 50,
    rotateAngles: [45, 60, 30, 90],
    maxLines: 2,
    ellipsisPosition: "end",
    safetyPad: 8,
    maxBottomRatio: 0.3,
    maxBottomPx: 168,
    minBottomPx: 28
  };

  /* ---------- ConfigParser ---------- */
  function parseConfig(raw) {
    var cfg = raw && typeof raw === "object" ? raw : {};
    var mode = cfg.mode || "auto";
    if (mode !== "auto" && mode !== "manual" && mode !== "custom") mode = "auto";
    var strategies = Array.isArray(cfg.strategies) && cfg.strategies.length
      ? cfg.strategies.filter(function (s) { return DEFAULT_STRATEGIES.indexOf(s) >= 0; })
      : DEFAULT_STRATEGIES.slice();
    var options = Object.assign({}, DEFAULT_OPTIONS, cfg.options || {});
    if (!Array.isArray(options.rotateAngles) || !options.rotateAngles.length) {
      options.rotateAngles = DEFAULT_OPTIONS.rotateAngles.slice();
    }
    return {
      mode: mode,
      strategies: strategies,
      options: options,
      responsive: cfg.responsive !== false,
      axis: cfg.axis === "y" || cfg.axis === "both" ? cfg.axis : "x",
      uiRule: cfg.uiRule || null
    };
  }

  /* 产品三档 → 引擎配置 */
  function configFromUiRule(uiRule, overrides) {
    var rule = uiRule || "smart";
    var base;
    if (rule === "sparse") {
      base = {
        mode: "custom",
        uiRule: "sparse",
        strategies: ["sampling", "rotating", "ellipsis"],
        options: {
          samplingThreshold: 0,
          sparseMaxTicks: 4,
          rotateAngles: [0, 45, 90]
        }
      };
    } else if (rule === "dense") {
      base = {
        mode: "custom",
        uiRule: "dense",
        strategies: ["rotating", "ellipsis", "sampling", "hiding"],
        options: {
          samplingThreshold: 100000,
          densePreferAll: true,
          rotateAngles: [0, 45, 90]
        }
      };
    } else {
      base = {
        mode: "auto",
        uiRule: "smart",
        strategies: DEFAULT_STRATEGIES.slice(),
        options: {
          samplingThreshold: 50,
          rotateAngles: [0, 45, 90]
        }
      };
    }
    if (overrides) {
      if (overrides.options) base.options = Object.assign({}, base.options, overrides.options);
      Object.keys(overrides).forEach(function (k) {
        if (k !== "options") base[k] = overrides[k];
      });
    }
    return parseConfig(base);
  }

  /* ---------- 工具 ---------- */
  function measureWidth(text, fontSize, fontFamily) {
    if (typeof document === "undefined") {
      return String(text || "").length * (fontSize || 11) * 0.6;
    }
    var canvas = measureWidth._c || (measureWidth._c = document.createElement("canvas"));
    var ctx = canvas.getContext("2d");
    ctx.font = (fontSize || 11) + "px " + (fontFamily || "sans-serif");
    return ctx.measureText(String(text == null ? "" : text)).width;
  }

  function sampleIndices(n, target) {
    n = Math.max(1, n | 0);
    target = Math.max(1, Math.min(n, target | 0));
    var out = [];
    var seen = {};
    if (target >= n) {
      for (var i = 0; i < n; i++) out.push(i);
      return out;
    }
    for (var k = 0; k < target; k++) {
      var idx = target === 1 ? 0 : Math.round((k * (n - 1)) / (target - 1));
      if (!seen[idx]) {
        seen[idx] = true;
        out.push(idx);
      }
    }
    return out;
  }

  function ellipsisToWidth(text, maxPx, fontSize, fontFamily) {
    var s = String(text == null ? "" : text);
    if (!s) return s;
    if (measureWidth(s, fontSize, fontFamily) <= maxPx) return s;
    var ell = "…";
    var lo = 1;
    var hi = s.length;
    var best = 1;
    while (lo <= hi) {
      var mid = (lo + hi) >> 1;
      var cand = s.slice(0, mid) + ell;
      if (measureWidth(cand, fontSize, fontFamily) <= maxPx) {
        best = mid;
        lo = mid + 1;
      } else hi = mid - 1;
    }
    return s.slice(0, Math.max(1, best)) + ell;
  }

  function wrapText(text, maxPx, maxLines, fontSize, fontFamily) {
    var s = String(text == null ? "" : text);
    if (!s || maxLines < 2) return { text: s, lines: 1, width: measureWidth(s, fontSize, fontFamily) };
    if (measureWidth(s, fontSize, fontFamily) <= maxPx) {
      return { text: s, lines: 1, width: measureWidth(s, fontSize, fontFamily) };
    }
    var lines = [];
    var rest = s;
    while (rest && lines.length < maxLines) {
      if (lines.length === maxLines - 1) {
        lines.push(ellipsisToWidth(rest, maxPx, fontSize, fontFamily));
        break;
      }
      var lo = 1;
      var hi = rest.length;
      var best = 1;
      while (lo <= hi) {
        var mid = (lo + hi) >> 1;
        if (measureWidth(rest.slice(0, mid), fontSize, fontFamily) <= maxPx) {
          best = mid;
          lo = mid + 1;
        } else hi = mid - 1;
      }
      best = Math.max(1, best);
      lines.push(rest.slice(0, best));
      rest = rest.slice(best);
    }
    var width = 0;
    lines.forEach(function (ln) {
      width = Math.max(width, measureWidth(ln, fontSize, fontFamily));
    });
    return { text: lines.join("\n"), lines: lines.length, width: width };
  }

  function bottomReserve(labelW, angle, fontSize, options) {
    var fs = fontSize || 11;
    var w = Math.max(fs, labelW || fs);
    var maxBottom = Math.max(
      options.minBottomPx || 28,
      Math.min(options.maxBottomPx || 168, Math.floor((options.containerH || 360) * (options.maxBottomRatio || 0.3)))
    );
    var need;
    if (angle === 90) need = Math.ceil(w + 14);
    else if (angle === 45 || angle === 60 || angle === 30) need = Math.ceil(w * 0.75 + fs + 20);
    else need = Math.ceil(fs * (options.wrapLines || 1) + 16);
    return Math.max(angle ? 48 : options.minBottomPx || 28, Math.min(maxBottom, need + (options.safetyPad || 8)));
  }

  /* ---------- StateEvaluator ---------- */
  function evaluateState(input) {
    var labels = input.labels || [];
    var n = labels.length || 1;
    var fs = input.fontSize || 11;
    var fontFamily = input.fontFamily || "sans-serif";
    var plotW = Math.max(80, input.plotWidth || 640);
    var containerH = input.containerH || 360;
    var texts = labels.map(function (lb, i) {
      if (typeof input.formatLabel === "function") return String(input.formatLabel(i, lb) || "");
      return String(lb == null ? "" : lb);
    });
    var maxW = fs;
    var totalW = 0;
    var step = n <= 64 ? 1 : Math.max(1, Math.floor(n / 32));
    for (var i = 0; i < n; i += step) {
      var w = measureWidth(texts[i], fs, fontFamily);
      maxW = Math.max(maxW, w);
      totalW += (w + Math.max(12, fs));
    }
    maxW = Math.max(maxW, measureWidth(texts[n - 1], fs, fontFamily));
    if (step > 1) totalW = totalW * (n / Math.max(1, Math.ceil(n / step)));
    else {
      totalW = 0;
      for (var j = 0; j < n; j++) totalW += measureWidth(texts[j], fs, fontFamily) + Math.max(12, fs);
    }
    var gap0 = maxW < 48 ? 8 : Math.max(10, fs);
    return {
      n: n,
      texts: texts,
      maxLabelW: maxW,
      totalLabelW: totalW,
      plotWidth: plotW,
      containerH: containerH,
      fontSize: fs,
      fontFamily: fontFamily,
      longLabel: maxW > 72,
      overflowRatio: totalW / Math.max(1, plotW),
      fit0: Math.max(2, Math.floor(plotW / Math.max(fs + 8, maxW + gap0))),
      fit45: Math.max(2, Math.floor(plotW / (maxW * 0.85 + 12))),
      fit90: Math.max(2, Math.floor(plotW / (fs + 10))),
      chartType: input.chartType || "line"
    };
  }

  /* ---------- StrategySelector ---------- */
  function selectStrategies(state, config) {
    var opts = config.options;
    var enabled = {};
    config.strategies.forEach(function (s) { enabled[s] = true; });
    var applied = ["sampling"];
    var ui = config.uiRule;
    var n = state.n;
    var fit0 = Math.max(2, state.fit0);
    var fit45 = Math.max(2, state.fit45);
    var fit90 = Math.max(2, state.fit90);
    var tickCount, angle = 0;

    if (state.chartType === "hbar") {
      tickCount = ui === "sparse" ? Math.min(4, n) : ui === "dense" ? Math.min(n, 16) : Math.min(8, n);
      return packDecision(tickCount, 0, false, false, true, 1, applied, state, opts);
    }
    if (state.chartType === "crossBar") {
      tickCount = ui === "sparse" ? Math.min(4, n) : ui === "dense" ? n : Math.min(n, 8);
      return packDecision(tickCount, 0, true, false, true, 1, applied.concat(["ellipsis"]), state, opts);
    }

    if (ui === "sparse") {
      tickCount = Math.min(4, n, fit0);
      angle = tickCount > fit0 ? 45 : 0;
    } else if (ui === "dense") {
      if (n <= fit0) { tickCount = n; angle = 0; }
      else if (n <= fit45) { tickCount = n; angle = 45; }
      else { tickCount = Math.min(n, Math.max(fit90, 8)); angle = 90; }
    } else {
      if (Math.min(8, n) <= fit0) { tickCount = Math.min(8, n); angle = 0; }
      else if (Math.min(8, n) <= fit45) { tickCount = Math.min(8, n); angle = 45; }
      else { tickCount = Math.min(8, n, fit90); angle = 90; }
    }
    tickCount = Math.max(2, Math.min(n, tickCount));
    if (angle) applied.push("rotating");
    if (enabled.hiding) applied.push("hiding");
    if (enabled.ellipsis) applied.push("ellipsis");
    return packDecision(tickCount, angle, true, false, true, 1, applied, state, opts);
  }

  function packDecision(tickCount, angle, useHide, useWrap, useEllipsis, wrapLines, applied, state, opts) {
    var cap = angle === 90 ? state.fit90 : (angle ? state.fit45 : state.fit0);
    cap = Math.max(2, cap);
    tickCount = Math.max(1, Math.min(state.n, cap, tickCount));
    if (tickCount < 2 && state.n >= 2) tickCount = Math.min(2, cap, state.n);
    var ticks = sampleIndices(state.n, tickCount);
    var slot = state.plotWidth / Math.max(1, ticks.length);
    var budget;
    /* 省略预算保底，避免「贰零壹…」这种只剩 3 字的怪异截断；卡片预览与编辑器同一下限 */
    var minBudget = state.fontSize * (angle === 90 ? 7 : angle ? 6 : 4);
    if (angle === 90) budget = Math.max(minBudget, Math.min(160, state.containerH * 0.32));
    else if (angle) budget = Math.max(minBudget, Math.min(slot * 1.25, 140));
    else budget = Math.max(minBudget, slot - 8);

    var displayMaxW = state.fontSize;
    ticks.forEach(function (i) {
      var t = state.texts[i] || "";
      var shown = t;
      if (useWrap) {
        var wr = wrapText(t, budget, wrapLines, state.fontSize, state.fontFamily);
        shown = wr.text;
        displayMaxW = Math.max(displayMaxW, wr.width);
      } else if (useEllipsis && measureWidth(t, state.fontSize, state.fontFamily) > budget) {
        shown = ellipsisToWidth(t, budget, state.fontSize, state.fontFamily);
        displayMaxW = Math.max(displayMaxW, measureWidth(shown, state.fontSize, state.fontFamily));
      } else {
        displayMaxW = Math.max(displayMaxW, measureWidth(t, state.fontSize, state.fontFamily));
      }
    });

    var reserve = bottomReserve(displayMaxW, angle, state.fontSize, Object.assign({}, opts, {
      containerH: state.containerH,
      wrapLines: useWrap ? wrapLines : 1
    }));

    return {
      tickCount: ticks.length,
      ticks: ticks,
      angle: angle,
      useHide: !!useHide,
      useWrap: !!useWrap,
      useEllipsis: useEllipsis !== false,
      wrapLines: wrapLines || 1,
      slotBudget: budget,
      maxDisplayW: displayMaxW,
      paddingBottom: reserve,
      applied: applied,
      rule: (opts && opts._uiRule) || null
    };
  }

  /* ---------- ConfigTranslator → G2 ---------- */
  function translateToG2(decision, state) {
    var allowed = {};
    decision.ticks.forEach(function (i) { allowed[i] = true; });
    var tickFilter = function (v) {
      var num = Number(v);
      var iv = Math.round(num);
      if (!isFinite(num) || Math.abs(num - iv) >= 1e-6) return false;
      return !!allowed[iv];
    };
    var transform = [];
    if (decision.angle) {
      transform.push({
        type: "rotate",
        optionalAngles: [decision.angle],
        recoverWhenFailed: false
      });
    }
    if (decision.useHide) {
      transform.push({ type: "hide", keepHeader: true, keepTail: true });
    }

    var formatLabel = function (v, fullText) {
      if (!tickFilter(v)) return "";
      var t = fullText == null ? String(v) : String(fullText);
      if (decision.useWrap) {
        return wrapText(t, decision.slotBudget, decision.wrapLines, state.fontSize, state.fontFamily).text;
      }
      if (decision.useEllipsis && measureWidth(t, state.fontSize, state.fontFamily) > decision.slotBudget) {
        return ellipsisToWidth(t, decision.slotBudget, state.fontSize, state.fontFamily);
      }
      return t;
    };

    return {
      tickCount: decision.tickCount,
      ticks: decision.ticks.slice(),
      tickFilter: tickFilter,
      labelFilter: function (datum) {
        var v = datum;
        if (datum && typeof datum === "object") {
          if (datum.value != null) v = datum.value;
          else if (datum.id != null) v = datum.id;
        }
        return tickFilter(v);
      },
      tickMethod: function () { return decision.ticks.slice(); },
      labelFormatter: formatLabel,
      size: decision.paddingBottom,
      transform: transform,
      labelAutoHide: false,
      labelAutoRotate: false,
      labelAutoWrap: decision.useWrap
        ? { maxLines: decision.wrapLines, recoverWhenFailed: true }
        : false,
      labelAutoEllipsis: false, /* 由 formatLabel 统一省略，避免与采样冲突 */
      paddingBottom: decision.paddingBottom,
      angle: decision.angle,
      slotBudget: decision.slotBudget,
      applied: decision.applied.slice(),
      decision: decision
    };
  }

  /* ---------- 主引擎 ---------- */
  function decide(input, rawConfig) {
    var config = rawConfig && rawConfig.uiRule
      ? configFromUiRule(rawConfig.uiRule, rawConfig)
      : parseConfig(rawConfig);
    if (rawConfig && rawConfig.uiRule) config.uiRule = rawConfig.uiRule;
    config.options._uiRule = config.uiRule;
    var state = evaluateState(input || {});
    var decision = selectStrategies(state, config);
    decision.rule = config.uiRule || config.mode;
    var g2 = translateToG2(decision, state);
    return {
      config: config,
      state: state,
      decision: decision,
      g2: g2,
      layout: {
        tickCount: decision.tickCount,
        angle: decision.angle,
        rule: decision.rule,
        maxW: decision.maxDisplayW,
        slotBudget: decision.slotBudget,
        reserve: decision.paddingBottom,
        ticks: decision.ticks.slice(),
        applied: decision.applied.slice(),
        useHide: decision.useHide,
        useWrap: decision.useWrap,
        useEllipsis: decision.useEllipsis
      }
    };
  }

  /* ---------- ResponsiveManager ---------- */
  function createResponsive(container, callback, delay) {
    delay = delay == null ? 300 : delay;
    var timer = null;
    var ro = null;
    function fire() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(function () {
        timer = null;
        if (typeof callback === "function") callback();
      }, delay);
    }
    if (typeof ResizeObserver !== "undefined" && container) {
      ro = new ResizeObserver(fire);
      ro.observe(container);
    }
    return {
      disconnect: function () {
        if (timer) clearTimeout(timer);
        if (ro) ro.disconnect();
      },
      trigger: fire
    };
  }

  /* ========== 3.6 图表容器充满策略 ========== */
  var DEFAULT_CONTAINER_FIT = {
    autoFit: true,
    responsive: true,
    debounceDelay: 300,
    padding: "auto",
    appendPadding: 0,
    clip: true
  };

  function parseContainerFit(raw) {
    var src = (raw && raw.containerFit) || raw || {};
    if (typeof src !== "object") src = {};
    var fit = Object.assign({}, DEFAULT_CONTAINER_FIT, src);
    fit.autoFit = fit.autoFit !== false;
    fit.responsive = fit.responsive !== false;
    fit.debounceDelay = Math.max(0, +fit.debounceDelay || 300);
    fit.clip = fit.clip !== false;
    return fit;
  }

  function padToTRBL(value, fallback) {
    var fb = fallback || { top: 16, right: 28, bottom: 44, left: 56 };
    if (value == null || value === "auto") return Object.assign({}, fb);
    if (typeof value === "number" && isFinite(value)) {
      return { top: value, right: value, bottom: value, left: value };
    }
    if (Array.isArray(value)) {
      if (value.length === 1) return padToTRBL(value[0], fb);
      if (value.length === 2) {
        return { top: +value[0] || 0, right: +value[1] || 0, bottom: +value[0] || 0, left: +value[1] || 0 };
      }
      if (value.length >= 4) {
        return {
          top: +value[0] || 0,
          right: +value[1] || 0,
          bottom: +value[2] || 0,
          left: +value[3] || 0
        };
      }
    }
    if (typeof value === "object") {
      return {
        top: value.top != null ? +value.top : fb.top,
        right: value.right != null ? +value.right : fb.right,
        bottom: value.bottom != null ? +value.bottom : fb.bottom,
        left: value.left != null ? +value.left : fb.left
      };
    }
    return Object.assign({}, fb);
  }

  function addPadding(a, b) {
    return {
      top: (a.top || 0) + (b.top || 0),
      right: (a.right || 0) + (b.right || 0),
      bottom: (a.bottom || 0) + (b.bottom || 0),
      left: (a.left || 0) + (b.left || 0)
    };
  }

  function readContainerSize(container) {
    var el = typeof container === "string"
      ? (typeof document !== "undefined" ? document.getElementById(container) : null)
      : container;
    if (!el) return { width: 0, height: 0, el: null };
    var w = Math.floor(el.clientWidth || 0);
    var h = Math.floor(el.clientHeight || 0);
    return { width: w, height: h, el: el };
  }

  /**
   * 空间预算：优先保证绘图区，再轴标签/标题/图例。
   * hints 由业务层（标签适配、单位、双轴）传入。
   */
  function resolveSpaceBudget(fit, hints) {
    hints = hints || {};
    var base = {
      top: hints.paddingTop != null ? hints.paddingTop : 16,
      right: hints.paddingRight != null ? hints.paddingRight : 28,
      bottom: hints.paddingBottom != null ? hints.paddingBottom : 44,
      left: hints.paddingLeft != null ? hints.paddingLeft : 56
    };
    /* padding:'auto' → 使用业务层根据标签/单位算出的预算；否则覆盖为自定义值 */
    var pad = fit.padding === "auto" || fit.padding == null
      ? base
      : padToTRBL(fit.padding, base);
    var append = padToTRBL(fit.appendPadding, { top: 0, right: 0, bottom: 0, left: 0 });
    var merged = addPadding(pad, append);
    /* 下限：避免轴标签被裁切 */
    if (hints.minBottom != null) merged.bottom = Math.max(merged.bottom, hints.minBottom);
    if (hints.minLeft != null) merged.left = Math.max(merged.left, hints.minLeft);
    if (hints.minTop != null) merged.top = Math.max(merged.top, hints.minTop);
    if (hints.minRight != null) merged.right = Math.max(merged.right, hints.minRight);
    return merged;
  }

  /**
   * 一级策略：生成 G2 Chart 挂载参数（autoFit + padding + clip）
   * autoFit:true 时不写死 width/height，让 G2 读取容器尺寸。
   */
  function buildChartMountOptions(container, fitRaw, hints) {
    var fit = parseContainerFit(fitRaw);
    var size = readContainerSize(container);
    var pad = resolveSpaceBudget(fit, hints);
    var opts = {
      autoFit: !!fit.autoFit,
      clip: !!fit.clip,
      margin: 0,
      paddingTop: pad.top,
      paddingRight: pad.right,
      paddingBottom: pad.bottom,
      paddingLeft: pad.left,
      _containerFit: fit,
      _space: pad
    };
    if (!fit.autoFit) {
      if (size.width > 16) opts.width = size.width;
      if (size.height > 16) opts.height = size.height;
    } else {
      /* autoFit 下仍可传入当前尺寸作首帧兜底，避免容器尚未布局时 0 尺寸 */
      if (size.width > 16) opts.width = size.width;
      if (size.height > 16) opts.height = size.height;
    }
    return opts;
  }

  /** 二级策略：强制按当前容器尺寸重新适配 */
  function forceFitChart(chart, container) {
    if (!chart) return false;
    var size = readContainerSize(container);
    if (size.width < 16 || size.height < 16) return false;
    try {
      if (typeof chart.changeSize === "function") {
        chart.changeSize(size.width, size.height);
        return true;
      }
    } catch (e1) {}
    try {
      if (typeof chart.forceFit === "function") {
        chart.forceFit();
        return true;
      }
    } catch (e2) {}
    try {
      if (typeof chart.changeSize === "function") {
        chart.changeSize(size.width, size.height);
        return true;
      }
    } catch (e3) {}
    return false;
  }

  /**
   * 三级策略：ResizeObserver 监听容器，防抖后 forceFit / 回调重渲染
   * getChart: () => chartInstance
   * onRefit: 可选，forceFit 失败或不想只改尺寸时做全量 renderChart
   */
  function attachContainerFit(options) {
    options = options || {};
    var fit = parseContainerFit(options.config || options);
    var container = options.container;
    var getChart = options.getChart;
    var onRefit = options.onRefit;
    var last = { w: 0, h: 0 };
    var alive = true;

    function refit() {
      if (!alive) return;
      var size = readContainerSize(container);
      if (size.width < 16 || size.height < 16) return;
      if (size.width === last.w && size.height === last.h) return;
      last.w = size.width;
      last.h = size.height;
      /* fullRelayout：尺寸变化时交给业务全量重绘（标签预算与充满策略闭环） */
      if (options.fullRelayout && typeof onRefit === "function") {
        onRefit(size);
        return;
      }
      var chart = typeof getChart === "function" ? getChart() : null;
      var ok = forceFitChart(chart, size.el || container);
      if (!ok && typeof onRefit === "function") onRefit(size);
      else if (ok && typeof options.onAfterFit === "function") options.onAfterFit(size);
    }

    var responsive = null;
    if (fit.responsive) {
      responsive = createResponsive(typeof container === "string"
        ? (typeof document !== "undefined" ? document.getElementById(container) : null)
        : container, refit, fit.debounceDelay);
    }

    return {
      config: fit,
      refit: refit,
      trigger: function () {
        last.w = 0;
        last.h = 0;
        refit();
      },
      disconnect: function () {
        alive = false;
        if (responsive) responsive.disconnect();
      },
      updateConfig: function (next) {
        fit = parseContainerFit(next);
        if (responsive) {
          responsive.disconnect();
          responsive = fit.responsive
            ? createResponsive(
              typeof container === "string"
                ? document.getElementById(container)
                : container,
              refit,
              fit.debounceDelay
            )
            : null;
        }
      }
    };
  }

  /* ========== 布局策略引擎 decideLayout ========== */
  var SURFACE_PROFILES = {
    editor: { tight: false, maxBottom: 120, minBottom: 24, gap: 8, unitTop: 24, sideMin: 8, leftMax: 64 },
    galleryPreview: { tight: true, maxBottom: 110, minBottom: 28, gap: 6, unitTop: 18, sideMin: 10, leftMax: 52, minPlotRatio: 0.32, minPlotFloor: 52 },
    galleryMini: { tight: true, maxBottom: 22, minBottom: 14, gap: 4, unitTop: 15, sideMin: 4, leftMax: 36 }
  };

  function resolveSurface(input) {
    var s = (input && input.surface) || "editor";
    if (s === "preview") s = "galleryPreview";
    if (!SURFACE_PROFILES[s]) s = "editor";
    return s;
  }

  function maxTextWidth(texts, fontSize, fontFamily) {
    var maxW = fontSize || 11;
    (texts || []).forEach(function (t) {
      maxW = Math.max(maxW, measureWidth(t, fontSize, fontFamily));
    });
    return maxW;
  }

  function measurePad(input, profile) {
    var chrome = (input && input.chrome) || {};
    var chartType = (input && input.chartType) || "line";
    if (chartType === "pie") {
      return { top: 4, right: 4, bottom: 4, left: 4 };
    }
    var fsY = input.yFontSize || 11;
    var fsX = input.fontSize || 11;
    var fontFamily = input.fontFamily || "sans-serif";
    var yW = maxTextWidth(input.yTickSamples && input.yTickSamples.length ? input.yTickSamples : ["888.8"], fsY, fontFamily);
    var yWR = maxTextWidth(input.yRightTickSamples && input.yRightTickSamples.length ? input.yRightTickSamples : (chrome.dualAxis ? ["888.8"] : []), fsY, fontFamily);
    var unitFs = input.unitFontSize || fsY;
    var left, right, top, bottom;
    if (chartType === "hbar") {
      var catW = maxTextWidth(input.labels && input.labels.length ? input.labels : ["类别"], fsX, fontFamily);
      left = Math.ceil(catW + profile.gap + 2);
      left = Math.max(profile.tight ? 36 : 48, Math.min(profile.tight ? 88 : 140, left));
      bottom = Math.max(profile.minBottom, Math.ceil(fsY + profile.gap));
    } else {
      left = Math.ceil(yW + profile.gap + 2);
      left = Math.max(profile.tight ? 24 : 32, Math.min(profile.leftMax || (profile.tight ? 36 : 64), left));
      if (chrome.yTitleOutside) left += Math.ceil(unitFs + 6);
      bottom = Math.ceil(fsX + profile.gap);
      if (chrome.xTitle) bottom += (input.titleFontSize || fsX) + 8;
      bottom = Math.max(profile.minBottom, Math.min(profile.maxBottom, bottom));
    }
    right = chrome.dualAxis ? Math.ceil(yWR + profile.gap + 2) : profile.sideMin;
    right = Math.max(profile.sideMin, Math.min(profile.tight ? 36 : 56, right));
    if (chrome.yTitleOutsideR) right += Math.ceil(unitFs + 6);
    /* 外置图例不占 G2 上边；轴上方标题占用 paddingTop */
    top = 4;
    if (chrome.yUnitTop) top = Math.ceil(unitFs + (profile.tight ? 6 : 10));
    if (chrome.legendOutside) top = Math.max(top, chrome.yUnitTop ? profile.unitTop : 4);
    else if (chrome.legendInsideTop) top += 22;
    top = Math.max(chrome.yUnitTop ? profile.unitTop : 4, Math.min(profile.tight ? 22 : 44, top));
    return { top: top, right: right, bottom: bottom, left: left };
  }

  /**
   * 一次决策：场景 + 空间预算 + 轴标签 + G2 挂载参数
   */
  function decideLayout(input) {
    input = input || {};
    var surface = resolveSurface(input);
    var profile = SURFACE_PROFILES[surface];
    var chrome = input.chrome || {};
    var size = readContainerSize(input.container);
    var cw = size.width || input.containerWidth || (surface === "galleryMini" ? 280 : 640);
    var ch = size.height || input.containerH || (surface === "galleryMini" ? 168 : 360);
    var pad0 = measurePad(input, profile);
    var plotW = Math.max(80, cw - pad0.left - pad0.right);
    var plotH = Math.max(60, ch - pad0.top - pad0.bottom);

    var uiRule = input.uiRule || "smart";
    var chartType = input.chartType || "line";
    var labelOpts = {};
    if (profile.tight) {
      labelOpts.maxBottomPx = profile.maxBottom;
      labelOpts.minBottomPx = profile.minBottom;
    }
    var labelConfig = Object.assign({ uiRule: uiRule }, input.labelConfig || {});
    labelConfig.options = Object.assign({}, labelConfig.options || {}, labelOpts);
    var labelResult = chartType === "pie"
      ? { layout: { tickCount: 0, angle: 0, ticks: [], applied: [], reserve: pad0.bottom }, g2: {} }
      : decide({
          labels: input.labels || [],
          plotWidth: plotW,
          containerH: ch,
          fontSize: input.fontSize || (profile.tight ? 10 : 11),
          fontFamily: input.fontFamily || "sans-serif",
          chartType: chartType,
          formatLabel: input.formatLabel
        }, labelConfig);

    var layout = labelResult.layout;
    var bottom = pad0.bottom;
    if (chartType !== "pie") {
      /* 旋转/密集标签必须按实测 reserve 留底，否则会叠进绘图区；标题另加，避免重复计入 */
      var titleBand = chrome.xTitle ? ((input.titleFontSize || input.fontSize || 11) + 8) : 0;
      var labelBottom = Math.max(profile.minBottom, layout.reserve || 0);
      bottom = Math.max(pad0.bottom, labelBottom + titleBand);
      bottom = Math.max(profile.minBottom, Math.min(profile.maxBottom, bottom));
    }

    var pad = {
      top: pad0.top,
      right: pad0.right,
      bottom: bottom,
      left: pad0.left
    };
    /* 小容器优先保证绘图区，避免长标签把柱/线压成一条细带 */
    if (ch > 48) {
      var minPlotH = profile.tight
        ? Math.max(profile.minPlotFloor || 72, Math.floor(ch * (profile.minPlotRatio || 0.55)))
        : Math.max(96, Math.floor(ch * 0.4));
      var maxBottomByPlot = Math.max(profile.minBottom, ch - pad.top - minPlotH);
      pad.bottom = Math.min(pad.bottom, maxBottomByPlot);
    }
    var fit = parseContainerFit(input.containerFit);
    var mount = buildChartMountOptions(input.container, fit, {
      paddingTop: pad.top,
      paddingRight: pad.right,
      paddingBottom: pad.bottom,
      paddingLeft: pad.left,
      minTop: pad.top,
      minRight: pad.right,
      minBottom: pad.bottom,
      minLeft: pad.left
    });

    return {
      surface: surface,
      profile: profile,
      padding: pad,
      plotWidth: plotW,
      plotHeight: plotH,
      clip: fit.clip !== false,
      autoFit: fit.autoFit !== false,
      label: layout,
      g2: labelResult.g2,
      applied: (layout.applied || []).concat(["spaceBudget", surface]),
      axisVisual: {
        grid: false,
        line: false,
        lineOpacity: 0,
        gridLineWidth: 0
      },
      axisX: Object.assign({}, labelResult.g2 || {}, {
        size: pad.bottom,
        labelAutoRotate: false,
        labelAutoHide: false,
        transform: layout.angle
          ? [{ type: "rotate", optionalAngles: [layout.angle], recoverWhenFailed: false }]
          : []
      }),
      labelShorten: (layout.maxW || 0) > 72 ? "yearMonth" : null,
      mount: {
        autoFit: mount.autoFit !== false,
        clip: mount.clip !== false,
        margin: 0,
        paddingTop: mount.paddingTop,
        paddingRight: mount.paddingRight,
        paddingBottom: mount.paddingBottom,
        paddingLeft: mount.paddingLeft,
        width: mount.width,
        height: mount.height,
        axis: { x: { title: false, grid: false }, y: { title: false, grid: false } }
      },
      _adapter: labelResult
    };
  }

  return {
    DEFAULT_STRATEGIES: DEFAULT_STRATEGIES.slice(),
    DEFAULT_CONTAINER_FIT: Object.assign({}, DEFAULT_CONTAINER_FIT),
    SURFACE_PROFILES: SURFACE_PROFILES,
    parseConfig: parseConfig,
    configFromUiRule: configFromUiRule,
    evaluateState: evaluateState,
    selectStrategies: selectStrategies,
    translateToG2: translateToG2,
    decide: decide,
    decideLayout: decideLayout,
    measurePad: measurePad,
    sampleIndices: sampleIndices,
    measureWidth: measureWidth,
    ellipsisToWidth: ellipsisToWidth,
    wrapText: wrapText,
    createResponsive: createResponsive,
    parseContainerFit: parseContainerFit,
    resolveSpaceBudget: resolveSpaceBudget,
    readContainerSize: readContainerSize,
    buildChartMountOptions: buildChartMountOptions,
    forceFitChart: forceFitChart,
    attachContainerFit: attachContainerFit
  };
})();
export default LabelAdapter;
