import { uid } from '../../utils/hash'
import { DEFAULT_FONT } from './ppt-model'

const C = 16

function poly(...pairs) {
  return { type: 'poly', points: pairs.map(([x, y]) => `${x},${y}`).join(' ') }
}
function polyline(...pairs) {
  return { type: 'polyline', points: pairs.map(([x, y]) => `${x},${y}`).join(' ') }
}
function path(d) {
  return { type: 'path', d }
}
function line(x1, y1, x2, y2) {
  return { type: 'line', x1, y1, x2, y2 }
}
function rect(x, y, w, h, rx = 0) {
  return { type: 'rect', x, y, w, h, rx }
}
function ellipse(cx = C, cy = C, rx = 13, ry = 13) {
  return { type: 'ellipse', cx, cy, rx, ry }
}
function gon(n, r = 13, rot = -Math.PI / 2) {
  const pts = []
  for (let i = 0; i < n; i++) {
    const a = rot + (i * 2 * Math.PI) / n
    pts.push([+(C + r * Math.cos(a)).toFixed(2), +(C + r * Math.sin(a)).toFixed(2)])
  }
  return poly(...pts)
}
function star(n, outer = 14, inner = 6.2) {
  const pts = []
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 === 0 ? outer : inner
    const a = -Math.PI / 2 + (i * Math.PI) / n
    pts.push([+(C + r * Math.cos(a)).toFixed(2), +(C + r * Math.sin(a)).toFixed(2)])
  }
  return poly(...pts)
}

function item(id, name, kind, draw, extra = {}) {
  return { id, name, kind, draw, ...extra }
}

export const SHAPE_GROUPS = [
  {
    id: 'line',
    name: '线条',
    items: [
      item('line', '直线', 'line', line(2, 16, 30, 16)),
      item('lineDown', '斜线', 'line', line(4, 6, 28, 26)),
      item('lineUp', '反斜线', 'line', line(4, 26, 28, 6)),
      item('lineArrow', '箭头线', 'line', line(2, 16, 30, 16), { arrows: 'end' }),
      item('elbow', '肘形', 'line', polyline([6, 6], [6, 26], [26, 26])),
      item('elbowArrow', '肘形箭头', 'line', polyline([6, 6], [6, 26], [26, 26]), { arrows: 'end' }),
      item('elbowBoth', '肘形双箭头', 'line', polyline([6, 6], [6, 26], [26, 26]), { arrows: 'both' }),
      item('curve', '曲线', 'line', path('M4 24 Q16 4 28 24')),
      item('curveArrow', '曲线箭头', 'line', path('M4 24 Q16 4 28 24'), { arrows: 'end' }),
      item('sCurve', 'S 曲线', 'line', path('M4 8 C12 8 12 24 20 24 S28 8 28 8')),
      item('sCurveArrow', 'S 曲线箭头', 'line', path('M4 8 C12 8 12 24 20 24 S28 24 28 24'), { arrows: 'end' }),
    ],
  },
  {
    id: 'rect',
    name: '矩形',
    items: [
      item('rect', '矩形', 'closed', rect(1, 1, 30, 30, 0)),
      item('roundRect', '圆角矩形', 'closed', rect(1, 1, 30, 30, 4)),
      item('roundRect1', '单圆角矩形', 'closed', path('M8 8 H24 Q28 8 28 12 V20 Q28 24 24 24 H8 Q4 24 4 20 V12 Q4 8 8 8 Z')),
      item('snipRect', '剪角矩形', 'closed', poly([8, 8], [28, 8], [28, 24], [4, 24], [4, 12])),
      item('snipRound', '剪角圆角', 'closed', path('M10 8 H24 Q28 8 28 12 V24 H8 Q4 24 4 20 V12 L10 8 Z')),
      item('foldRect', '折角矩形', 'closed', path('M4 8 H22 L28 14 V24 H4 Z M22 8 V14 H28')),
      item('roundSame', '同侧圆角', 'closed', path('M4 12 Q4 8 8 8 H24 Q28 8 28 12 V24 H4 Z')),
    ],
  },
  {
    id: 'basic',
    name: '基本形状',
    items: [
      item('textbox', '文本框', 'text', rect(1, 1, 30, 30, 0)),
      item('parallelogram', '平行四边形', 'closed', poly([8, 8], [30, 8], [24, 24], [2, 24])),
      item('trapezoid', '梯形', 'closed', poly([8, 8], [24, 8], [30, 24], [2, 24])),
      item('diamond', '菱形', 'closed', poly([16, 3], [29, 16], [16, 29], [3, 16])),
      item('pentagon', '五边形', 'closed', gon(5)),
      item('hexagon', '六边形', 'closed', gon(6, 13, 0)),
      item('heptagon', '七边形', 'closed', gon(7)),
      item('octagon', '八边形', 'closed', gon(8, 13, Math.PI / 8)),
      item('decagon', '十边形', 'closed', gon(10)),
      item('pie', '饼形', 'closed', path('M16 16 L16 3 A13 13 0 1 1 5.5 22.5 Z')),
      item('chord', '弦形', 'closed', path('M6 8 A13 13 0 1 1 26 24 L6 8 Z')),
      item('teardrop', '泪滴', 'closed', path('M16 4 Q28 4 28 16 A12 12 0 1 1 16 4 Z')),
      item('frame', '框架', 'closed', path('M4 6 H28 V26 H4 Z M8 10 H24 V22 H8 Z')),
      item('halfFrame', '半框架', 'closed', path('M4 6 H28 V12 H10 V26 H4 Z')),
      item('lShape', 'L 形', 'closed', path('M6 6 H14 V18 H26 V26 H6 Z')),
      item('plusShape', '十字', 'closed', path('M13 4 H19 V13 H28 V19 H19 V28 H13 V19 H4 V13 H13 Z')),
      item('donut', '圆环', 'closed', path('M16 3 A13 13 0 1 1 15.99 3 Z M16 10 A6 6 0 1 0 16.01 10 Z')),
      item('noSymbol', '禁止符', 'closed', path('M16 3 A13 13 0 1 1 15.99 3 Z M8.2 7.4 L24.6 23.8 M16 8 A8 8 0 1 0 16.01 8 Z')),
      item('blockArc', '空心弧', 'closed', path('M6 22 A12 12 0 1 1 26 22 L22 20 A8 8 0 1 0 10 20 Z')),
      item('smiley', '笑脸', 'closed', path('M16 3 A13 13 0 1 1 15.99 3 Z M11 13 A1.4 1.4 0 1 0 11.01 13 Z M21 13 A1.4 1.4 0 1 0 21.01 13 Z M10 19 Q16 25 22 19')),
      item('heart', '心形', 'closed', path('M16 27 C6 19 4 12 8 8 C11 5 14 6 16 10 C18 6 21 5 24 8 C28 12 26 19 16 27 Z')),
      item('lightning', '闪电', 'closed', poly([18, 3], [10, 16], [16, 16], [12, 29], [24, 14], [17, 14])),
      item('sun', '太阳', 'closed', path('M16 9 A7 7 0 1 1 15.99 9 Z M16 2 V6 M16 26 V30 M2 16 H6 M26 16 H30 M5.5 5.5 L8.3 8.3 M23.7 23.7 L26.5 26.5 M26.5 5.5 L23.7 8.3 M8.3 23.7 L5.5 26.5')),
      item('moon', '月亮', 'closed', path('M20 4 A12 12 0 1 0 20 28 A9 9 0 1 1 20 4 Z')),
      item('cloud', '云形', 'closed', path('M10 22 H24 A5 5 0 0 0 24 12 A6.5 6.5 0 0 0 12 12 A5 5 0 0 0 8 21 Z')),
      item('arc', '弧形', 'line', path('M6 24 A12 12 0 0 1 26 24')),
      item('bracketL', '左方括号', 'line', path('M14 6 H8 V26 H14')),
      item('bracketR', '右方括号', 'line', path('M18 6 H24 V26 H18')),
      item('braceL', '左花括号', 'line', path('M16 5 Q10 5 10 10 Q10 16 6 16 Q10 16 10 22 Q10 27 16 27')),
      item('braceR', '右花括号', 'line', path('M16 5 Q22 5 22 10 Q22 16 26 16 Q22 16 22 22 Q22 27 16 27')),
    ],
  },
  {
    id: 'arrow',
    name: '箭头总汇',
    items: [
      item('arrowRight', '右箭头', 'closed', poly([2, 12], [18, 12], [18, 6], [30, 16], [18, 26], [18, 20], [2, 20])),
      item('arrowLeft', '左箭头', 'closed', poly([30, 12], [14, 12], [14, 6], [2, 16], [14, 26], [14, 20], [30, 20])),
      item('arrowUp', '上箭头', 'closed', poly([12, 30], [12, 14], [6, 14], [16, 2], [26, 14], [20, 14], [20, 30])),
      item('arrowDown', '下箭头', 'closed', poly([12, 2], [12, 18], [6, 18], [16, 30], [26, 18], [20, 18], [20, 2])),
      item('arrowLR', '左右箭头', 'closed', poly([2, 16], [10, 8], [10, 12], [22, 12], [22, 8], [30, 16], [22, 24], [22, 20], [10, 20], [10, 24])),
      item('arrowUD', '上下箭头', 'closed', poly([16, 2], [8, 10], [12, 10], [12, 22], [8, 22], [16, 30], [24, 22], [20, 22], [20, 10], [24, 10])),
      item('arrowQuad', '十字箭头', 'closed', poly([16, 2], [12, 8], [14, 8], [14, 14], [8, 14], [8, 12], [2, 16], [8, 20], [8, 18], [14, 18], [14, 24], [12, 24], [16, 30], [20, 24], [18, 24], [18, 18], [24, 18], [24, 20], [30, 16], [24, 12], [24, 14], [18, 14], [18, 8], [20, 8])),
      item('chevron', '燕尾箭头', 'closed', poly([4, 8], [20, 8], [28, 16], [20, 24], [4, 24], [12, 16])),
      item('notched', '燕尾', 'closed', poly([2, 10], [22, 10], [30, 16], [22, 22], [2, 22], [8, 16])),
      item('pentaArrow', '五边形箭头', 'closed', poly([2, 8], [20, 8], [30, 16], [20, 24], [2, 24])),
      item('bentArrow', '弯箭头', 'closed', path('M6 26 V14 H20 L20 8 L30 16 L20 24 V18 H10 V26 Z')),
      item('uTurn', '掉头箭头', 'closed', path('M8 26 V12 A8 8 0 0 1 24 12 V16 L30 10 L24 4 V8 A12 12 0 0 0 4 12 V26 Z')),
      item('striped', '条纹箭头', 'closed', path('M2 10 H6 V22 H2 Z M8 10 H12 V22 H8 Z M14 10 H20 L30 16 L20 22 H14 Z')),
      item('circArrow', '环形箭头', 'closed', path('M16 5 A11 11 0 1 1 6 18 L9 18 A8 8 0 1 0 16 8 V12 L24 6 L16 0 Z')),
    ],
  },
  {
    id: 'formula',
    name: '公式形状',
    items: [
      item('mathPlus', '加号', 'closed', path('M14 6 H18 V14 H26 V18 H18 V26 H14 V18 H6 V14 H14 Z')),
      item('mathMinus', '减号', 'closed', rect(6, 14, 20, 4, 1)),
      item('mathMul', '乘号', 'closed', path('M8.5 7.5 L16 15 L23.5 7.5 L26.5 10.5 L19 18 L26.5 25.5 L23.5 28.5 L16 21 L8.5 28.5 L5.5 25.5 L13 18 L5.5 10.5 Z')),
      item('mathDiv', '除号', 'closed', path('M16 7 A2.4 2.4 0 1 1 15.99 7 Z M6 15 H26 V17 H6 Z M16 23 A2.4 2.4 0 1 1 15.99 23 Z')),
      item('mathEq', '等号', 'closed', path('M6 12 H26 V15 H6 Z M6 18 H26 V21 H6 Z')),
      item('mathNeq', '不等号', 'closed', path('M6 12 H26 V15 H6 Z M6 18 H26 V21 H6 Z M9 8 L23 24 L21 26 L7 10 Z')),
    ],
  },
  {
    id: 'flow',
    name: '流程图',
    items: [
      item('flowProcess', '过程', 'closed', rect(4, 8, 24, 16, 0)),
      item('flowAlt', '可选过程', 'closed', rect(4, 8, 24, 16, 6)),
      item('flowDecision', '决策', 'closed', poly([16, 4], [30, 16], [16, 28], [2, 16])),
      item('flowData', '数据', 'closed', poly([8, 8], [30, 8], [24, 24], [2, 24])),
      item('flowPre', '预定义', 'closed', path('M4 8 H28 V24 H4 Z M8 8 V24 M24 8 V24')),
      item('flowInternal', '内部贮存', 'closed', path('M4 8 H28 V24 H4 Z M4 12 H28 M8 8 V24')),
      item('flowDoc', '文档', 'closed', path('M5 6 H27 V21 Q22 26 16 21 Q10 16 5 21 Z')),
      item('flowMulti', '多文档', 'closed', path('M8 5 H27 V8 H29 V22 Q24 26 18 22 V9 H8 Z M5 8 H24 V23 Q19 27 13 23 Q8 19 5 23 Z')),
      item('flowTerm', '终止', 'closed', rect(4, 10, 24, 12, 8)),
      item('flowPrep', '准备', 'closed', poly([8, 8], [24, 8], [30, 16], [24, 24], [8, 24], [2, 16])),
      item('flowManualIn', '手工输入', 'closed', poly([4, 10], [28, 6], [28, 24], [4, 24])),
      item('flowManualOp', '手工操作', 'closed', poly([4, 8], [28, 8], [24, 24], [8, 24])),
      item('flowConnector', '连接符', 'closed', ellipse()),
      item('flowOffPage', '离页', 'closed', poly([6, 6], [26, 6], [26, 20], [16, 28], [6, 20])),
      item('flowCard', '卡片', 'closed', poly([8, 6], [28, 6], [28, 26], [4, 26], [4, 12])),
      item('flowDisplay', '显示', 'closed', path('M8 8 H24 Q30 16 24 24 H8 Q2 16 8 8 Z')),
      item('flowDelay', '延迟', 'closed', path('M6 8 H20 Q28 8 28 16 Q28 24 20 24 H6 Z')),
      item('flowOr', '或', 'closed', path('M16 3 A13 13 0 1 1 15.99 3 Z M16 3 V29 M3 16 H29')),
    ],
  },
  {
    id: 'star',
    name: '星与旗帜',
    items: [
      item('star4', '四角星', 'closed', star(4, 14, 5)),
      item('star5', '五角星', 'closed', star(5)),
      item('star6', '六角星', 'closed', star(6, 14, 6.5)),
      item('star7', '七角星', 'closed', star(7, 14, 7)),
      item('star8', '八角星', 'closed', star(8, 14, 7)),
      item('star10', '十角星', 'closed', star(10, 14, 8)),
      item('star12', '十二角星', 'closed', star(12, 14, 9)),
      item('star16', '十六角星', 'closed', star(16, 14, 10)),
      item('star24', '二十四角星', 'closed', star(24, 14, 11)),
      item('star32', '三十二角星', 'closed', star(32, 14, 11.4)),
      item('ribbon', '带形', 'closed', path('M4 10 H28 L24 16 L28 22 H4 L8 16 Z')),
      item('wave', '波形', 'closed', path('M4 10 Q10 4 16 10 T28 10 V22 Q22 28 16 22 T4 22 Z')),
      item('scroll', '卷轴', 'closed', path('M8 6 H24 Q28 6 28 10 V22 Q28 26 24 26 H8 Q4 26 4 22 V10 Q4 6 8 6 Z M8 6 Q12 8 8 10 M24 22 Q20 24 24 26')),
      item('explosion', '爆炸形', 'closed', star(8, 14, 4.5)),
      item('banner', '横幅', 'closed', poly([2, 10], [28, 10], [24, 16], [28, 22], [2, 22], [6, 16])),
      item('upRibbon', '上凸带', 'closed', path('M4 12 H12 L16 6 L20 12 H28 L24 22 H8 Z')),
    ],
  },
  {
    id: 'callout',
    name: '标注',
    items: [
      item('callRect', '矩形标注', 'closed', path('M4 6 H28 V20 H18 L14 28 L14 20 H4 Z')),
      item('callRound', '圆角标注', 'closed', path('M8 6 H24 Q28 6 28 10 V18 Q28 22 24 22 H16 L12 29 L13 22 H8 Q4 22 4 18 V10 Q4 6 8 6 Z')),
      item('callOval', '椭圆形标注', 'closed', path('M16 5 A12 8 0 1 1 15.99 5 Z M14 21 L12 29 L18 22')),
      item('callCloud', '云形标注', 'closed', path('M10 20 H23 A4.5 4.5 0 0 0 23 11 A6 6 0 0 0 12 11 A4.5 4.5 0 0 0 8 19 Z M12 21 L9 29 L16 22')),
      item('callLine', '线性标注', 'closed', path('M4 6 H28 V18 H4 Z M10 18 L8 28')),
      item('callLine2', '线性标注 2', 'closed', path('M4 6 H28 V18 H4 Z M22 18 L26 28')),
      item('callLine3', '线性标注 3', 'closed', path('M4 6 H28 V16 H4 Z M16 16 V22 H26 L24 28')),
      item('callAccent', '强调线标注', 'closed', path('M6 6 H28 V20 H6 Z M4 6 V20 M12 20 L10 28')),
    ],
  },
]

export const SHAPE_MAP = Object.fromEntries(SHAPE_GROUPS.flatMap((g) => g.items.map((it) => [it.id, it])))

export function shapeById(id) {
  return SHAPE_MAP[id] || SHAPE_MAP.rect
}

export const STROKE_WIDTHS = [0.25, 0.5, 0.75, 1, 1.5, 2.25, 3, 4.5, 6]

export const DASHES = [
  { id: 'solid', label: '实线' },
  { id: 'roundDot', label: '圆点' },
  { id: 'squareDot', label: '方点' },
  { id: 'dash', label: '虚线' },
  { id: 'longDash', label: '长划线' },
  { id: 'dashDot', label: '点划线' },
  { id: 'longDashDot', label: '长划点' },
  { id: 'dashDotDot', label: '双点划线' },
]

export const TEXTBOX_PRESETS = [
  { id: 'body', name: '正文', text: '文本', fontSize: 16, bold: false, w: 42, h: 7, align: 'left' },
  { id: 'title', name: '标题', text: '标题', fontSize: 32, bold: true, w: 48, h: 9, align: 'left' },
  { id: 'subtitle', name: '副标题', text: '副标题', fontSize: 20, bold: false, w: 42, h: 8, align: 'left' },
]

export const ARROWS = [
  { id: 'none', label: '无箭头' },
  { id: 'end', label: '末端箭头' },
  { id: 'start', label: '起点箭头' },
  { id: 'both', label: '双向箭头' },
]

export function dashCap(id, isLine = false) {
  if (id === 'roundDot' || id === 'dot') return 'round'
  return isLine ? 'round' : 'butt'
}

export function dashPattern(id, sw = 1) {
  const s = Math.max(0.75, Number(sw) || 1)
  const seq = (...ns) => ns.map((n) => `${+n.toFixed(2)}px`).join(' ')
  switch (id) {
    case 'roundDot':
    case 'dot':
      return seq(0, s * 2.6)
    case 'squareDot':
      return seq(s * 1.1, s * 2.2)
    case 'dash':
      return seq(s * 5.5, s * 3.2)
    case 'longDash':
      return seq(s * 11, s * 3.8)
    case 'dashDot':
    case 'dashdot':
      return seq(s * 7.5, s * 2.8, s * 1.1, s * 2.8)
    case 'longDashDot':
      return seq(s * 13, s * 3.2, s * 1.1, s * 3.2)
    case 'dashDotDot':
      return seq(s * 7.5, s * 2.6, s * 1.1, s * 2.6, s * 1.1, s * 2.6)
    default:
      return 'none'
  }
}

export function dashArray(id, sw = 2) {
  const css = dashPattern(id, sw)
  if (!css || css === 'none') return ''
  return css.replace(/px/g, '')
}

export function emptyTextBox(presetId = 'body', dir = 'h') {
  const p = TEXTBOX_PRESETS.find((x) => x.id === presetId)
  const vert = dir === 'v'
  const extras = {
    align: 'left',
    writingMode: vert ? 'vertical' : 'horizontal',
    strokeWidth: 0.75,
    strokeColor: '#8f959e',
    strokeNone: false,
    fillNone: true,
    fill: '#ffffff',
    fillAlpha: 0,
  }
  if (!p) {
    return emptyShape('textbox', {
      ...extras,
      text: '',
      fontSize: 16,
      w: vert ? 8 : 42,
      h: vert ? 36 : 7,
      x: vert ? 46 : 29,
      y: vert ? 28 : 42,
    })
  }
  return emptyShape('textbox', {
    ...extras,
    text: p.text,
    fontSize: p.fontSize,
    bold: p.bold,
    align: p.align,
    w: vert ? Math.max(7, p.h) : p.w,
    h: vert ? Math.round(p.w * 0.7) : p.h,
    x: vert ? 46 : 29,
    y: vert ? 28 : 42,
  })
}

export function emptyShape(def, extras = {}) {
  const d = typeof def === 'string' ? shapeById(def) : def
  const kind = d.kind || 'closed'
  const isLine = kind === 'line'
  const isText = kind === 'text'
  return {
    id: uid('SH'),
    shape: d.id,
    kind,
    x: extras.x ?? (isLine ? 18 : 38),
    y: extras.y ?? (isLine ? 44 : 32),
    w: extras.w ?? (isLine ? 40 : isText ? 42 : 20),
    h: extras.h ?? (isLine ? 10 : isText ? 7 : 18),
    rotate: 0,
    strokeWidth: isText ? 0.75 : 1,
    strokeDash: 'solid',
    strokeNone: false,
    strokeColor: isText ? '#8f959e' : '#4e5969',
    fill: isText ? '#ffffff' : '#dbe7ff',
    fillNone: isLine || isText ? true : false,
    fillAlpha: 0,
    arrows: d.arrows || 'none',
    text: isText ? '文本' : '',
    fontSize: 16,
    fontFamily: DEFAULT_FONT,
    color: '#1d2129',
    bold: false,
    italic: false,
    align: 'center',
    writingMode: 'horizontal',
    ...extras,
    id: extras.id || uid('SH'),
    shape: d.id,
    kind,
  }
}

export function ensureShapes(slide) {
  if (!slide) return []
  if (!Array.isArray(slide.shapes)) slide.shapes = []
  return slide.shapes
}
