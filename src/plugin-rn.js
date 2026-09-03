import { definePlugin } from '@tempad-dev/plugins'

/**
 * Timo RN —— 把 Figma 导出的 CSS 转成 rn-store 仓库的 React Native StyleSheet 写法
 *
 * 约定全部来自 rn-store 仓库 skill `rn-ui-from-design` 与 withdraw 模块现有代码：
 * - 尺寸：750 设计稿 px 包一层 s()；0 / 百分比 / flex / opacity / zIndex / 阴影不包
 * - RTL：left/right → start/end，margin/padding 左右 → Start/End，单角圆角 → Start/End
 * - 文字：fontSize + lineHeight + color 三件套；稿上没标行高时按 fontSize + 8 兜底
 * - 阴影：shadowColor 保留 rgba + shadowOpacity: 1，安卓另给 elevation（照抄仓库写法）
 * - 渐变 / 内阴影 / filter 等 RN 不支持的，转成 `// ⚠` 提示而不是硬塞属性
 */

/** Figma 画板基准宽 = 750，与仓库 s() 基准一致 → 1:1 直出；若换成 375 稿，这里改成 2 */
const DESIGN_SCALE = 1

/** 静默丢弃：RN 没有对应概念，且丢了也不影响还原 */
const DROP_SILENT = new Set([
  'box-sizing',
  'font-family',
  'font-feature-settings',
  'font-variant',
  'font-variant-numeric',
  'font-stretch',
  '-webkit-font-smoothing',
  '-moz-osx-font-smoothing',
  '-webkit-text-size-adjust',
  '-webkit-box-orient',
  '-webkit-tap-highlight-color',
  'white-space',
  'word-break',
  'word-wrap',
  'overflow-wrap',
  'text-wrap',
  'cursor',
  'outline',
  'outline-offset',
  'list-style',
  'transition',
  'transition-property',
  'animation',
  'will-change',
  'user-select',
  '-webkit-user-select',
  'vertical-align',
  'text-rendering',
  'background-repeat',
  'background-position',
  'background-size',
  'background-image',
  'isolation',
  'content',
  'visibility',
  'box-decoration-break'
])

/** 输出顺序：定位 → 布局 → 尺寸 → 间距 → 背景边框 → 阴影 → 变换 → 文字 */
const ORDER = [
  'position', 'top', 'bottom', 'start', 'end', 'zIndex',
  'display', 'flexDirection', 'flexWrap', 'justifyContent', 'alignItems', 'alignContent', 'alignSelf',
  'flex', 'flexGrow', 'flexShrink', 'flexBasis',
  'gap', 'rowGap', 'columnGap',
  'width', 'height', 'minWidth', 'maxWidth', 'minHeight', 'maxHeight', 'aspectRatio',
  'margin', 'marginVertical', 'marginHorizontal', 'marginTop', 'marginEnd', 'marginBottom', 'marginStart',
  'padding', 'paddingVertical', 'paddingHorizontal', 'paddingTop', 'paddingEnd', 'paddingBottom', 'paddingStart',
  'backgroundColor',
  'borderWidth', 'borderTopWidth', 'borderEndWidth', 'borderBottomWidth', 'borderStartWidth',
  'borderColor', 'borderTopColor', 'borderEndColor', 'borderBottomColor', 'borderStartColor',
  'borderStyle',
  'borderRadius', 'borderTopStartRadius', 'borderTopEndRadius', 'borderBottomEndRadius', 'borderBottomStartRadius',
  'overflow', 'opacity', 'pointerEvents',
  'shadowColor', 'shadowOpacity', 'shadowRadius', 'shadowOffset', 'elevation',
  'transform',
  'fontSize', 'lineHeight', 'fontWeight', 'fontStyle', 'color',
  'letterSpacing', 'textAlign', 'textAlignVertical', 'includeFontPadding',
  'textDecorationLine', 'textTransform', 'writingDirection',
  'textShadowColor', 'textShadowOffset', 'textShadowRadius'
]

/** 属于 Text 的样式，用来在输出里分出「// 文字」分组，方便拆成两个 StyleSheet 条目 */
const TEXT_KEYS = new Set([
  'fontSize', 'lineHeight', 'fontWeight', 'fontStyle', 'color', 'letterSpacing',
  'textAlign', 'textAlignVertical', 'includeFontPadding', 'textDecorationLine',
  'textTransform', 'writingDirection', 'textShadowColor', 'textShadowOffset', 'textShadowRadius'
])

/** 按顶层括号深度切分，避免把 rgba(0, 0, 0, .5) 里的逗号/空格切开 */
function splitTop(input, sep) {
  const out = []
  let depth = 0
  let cur = ''
  for (const ch of String(input)) {
    if (ch === '(') depth++
    if (ch === ')') depth--
    const isSep = depth === 0 && (sep === ' ' ? /\s/.test(ch) : ch === sep)
    if (isSep) {
      if (cur.trim()) out.push(cur.trim())
      cur = ''
      continue
    }
    cur += ch
  }
  if (cur.trim()) out.push(cur.trim())
  return out
}

/** 数值取两位小数并去掉多余的 0 */
function n2(value) {
  return String(Math.round(value * 100) / 100)
}

/**
 * 解析长度：返回 { px } | { raw } | null
 * px 已乘 DESIGN_SCALE，raw 是百分比 / auto 这类要原样带引号输出的值
 */
function parseLen(value, ctx) {
  if (value == null) return null
  const v = String(value).trim()
  if (!v || v === 'normal' || v === 'none' || v === 'inherit' || v === 'initial') return null
  if (v === 'auto') return { raw: "'auto'" }
  if (/^-?[\d.]+%$/.test(v)) return { raw: `'${v}'` }
  const m = /^(-?[\d.]+)(px|rem|em|pt)?$/.exec(v)
  if (!m) return null
  let px = parseFloat(m[1])
  if (m[2] === 'rem' || m[2] === 'em') px *= ctx.rootFontSize
  return { px: px * DESIGN_SCALE }
}

/** 长度 → 代码：0 直出 0，其余包 s() */
function len(value, ctx) {
  const parsed = parseLen(value, ctx)
  if (!parsed) return null
  if (parsed.raw) return parsed.raw
  return parsed.px === 0 ? '0' : `s(${n2(parsed.px)})`
}

/** 不包 s() 的裸数值（阴影、opacity、zIndex 等） */
function bare(value, ctx) {
  const parsed = parseLen(value, ctx)
  if (!parsed) return null
  return parsed.raw ? parsed.raw : n2(parsed.px)
}

/**
 * 变量显示模式为 'both' 时值形如 `var(--x, 32px)` / `var(--x, rgba(0,0,0,.06))`，
 * 先把 fallback 里的真值取出来，后面按普通值处理。
 * 模式为 'resolved' 时 tempad 已经替换成真值；'reference' 模式下真值被 stripFallback 抹掉了，
 * 插件侧拿不到，只能提示用户改偏好设置。
 */
function resolveVarFallbacks(value) {
  return String(value).replace(
    /var\(\s*--[^,()]+,\s*([^()]*(?:\([^()]*\)[^()]*)*)\)/g,
    (_, fallback) => fallback.trim()
  )
}

/** 色值归一：拆掉 var() 取兜底值，短 hex 补全并大写，rgba 原样保留 */
function normalizeColor(input) {
  let v = String(input).trim()
  const varFallback = /^var\([^,]+,\s*([\s\S]+)\)$/.exec(v)
  if (varFallback) v = varFallback[1].trim()
  if (/^#[0-9a-f]{3,4}$/i.test(v)) {
    v = '#' + v.slice(1).split('').map((c) => c + c).join('')
  }
  if (/^#[0-9a-f]{6,8}$/i.test(v)) return v.toUpperCase()
  return v.replace(/\s+/g, ' ')
}

function color(input) {
  return `'${normalizeColor(input)}'`
}

/** 是否是色值 token（用来在 border / box-shadow 的简写里挑出颜色） */
function isColorToken(token) {
  return /^(#|rgba?\(|hsla?\(|var\()/i.test(token) || /^(transparent|currentcolor|white|black|red)$/i.test(token)
}

const FONT_WEIGHT_MAP = {
  thin: '100',
  extralight: '200',
  ultralight: '200',
  light: '300',
  regular: '400',
  normal: '400',
  medium: '500',
  semibold: '600',
  demibold: '600',
  bold: '700',
  extrabold: '800',
  ultrabold: '800',
  black: '900',
  heavy: '900'
}

/**
 * 核心转换：CSS 键值对 → RN 样式键值对
 * @returns {{ props: Map<string, string>, notes: string[] }}
 */
function toRNStyle(style, ctx) {
  const props = new Map()
  const notes = []
  /** 挂在具体属性行尾的说明，比顶部全局提示省眼 */
  const comments = new Map()
  /** 没做映射的属性，注释掉输出，不污染样式也不悄悄丢信息 */
  const unknown = []
  const set = (key, code) => {
    if (code != null && code !== '') props.set(key, code)
  }
  const note = (text) => {
    if (!notes.includes(text)) notes.push(text)
  }

  /** line-height / letter-spacing 的百分比要靠 font-size 换算 */
  const fontSizeParsed = parseLen(style['font-size'], ctx)
  const fontSizePx = fontSizeParsed && fontSizeParsed.px != null ? fontSizeParsed.px : null

  /** 四值简写展开：CSS 顺序 top right bottom left → RN 用 Start/End 保 RTL */
  const setBox = (prefix, value) => {
    const parts = splitTop(value, ' ')
    const [a, b, c, d] = parts
    if (parts.length === 1) {
      set(prefix, len(a, ctx))
    } else if (parts.length === 2) {
      set(`${prefix}Vertical`, len(a, ctx))
      set(`${prefix}Horizontal`, len(b, ctx))
    } else if (parts.length === 3) {
      set(`${prefix}Top`, len(a, ctx))
      set(`${prefix}Horizontal`, len(b, ctx))
      set(`${prefix}Bottom`, len(c, ctx))
    } else if (parts.length >= 4) {
      set(`${prefix}Top`, len(a, ctx))
      set(`${prefix}End`, len(b, ctx))
      set(`${prefix}Bottom`, len(c, ctx))
      set(`${prefix}Start`, len(d, ctx))
    }
  }

  /** border / border-top 这类简写：宽度 + 颜色 +（非实线才输出）样式 */
  const setBorder = (side, value) => {
    if (/^(none|0)$/.test(String(value).trim())) return
    const tokens = splitTop(value, ' ')
    const styleToken = tokens.find((t) => /^(solid|dashed|dotted)$/i.test(t))
    const colorToken = tokens.find(isColorToken)
    const widthToken = tokens.find((t) => parseLen(t, ctx))
    if (widthToken) set(`border${side}Width`, len(widthToken, ctx))
    if (colorToken) set(`border${side}Color`, color(colorToken))
    if (styleToken && styleToken.toLowerCase() !== 'solid') {
      set('borderStyle', `'${styleToken.toLowerCase()}'`)
      if (styleToken.toLowerCase() === 'dashed') {
        note('虚线边框安卓表现不稳定，能用图片就换图片')
      }
    }
  }

  /** border-radius 简写：CSS 角顺序 TL TR BR BL → RN 逻辑角 */
  const setRadius = (value) => {
    const raw = String(value)
    if (raw.includes('/')) {
      note('border-radius 是椭圆圆角，已只取水平半径')
    }
    const parts = splitTop(raw.split('/')[0], ' ')
    const CORNERS = ['borderTopStartRadius', 'borderTopEndRadius', 'borderBottomEndRadius', 'borderBottomStartRadius']
    if (parts.length === 1) {
      set('borderRadius', len(parts[0], ctx))
      return
    }
    const map = parts.length === 2
      ? [parts[0], parts[1], parts[0], parts[1]]
      : parts.length === 3
        ? [parts[0], parts[1], parts[2], parts[1]]
        : parts
    CORNERS.forEach((key, i) => set(key, len(map[i], ctx)))
  }

  /** box-shadow → iOS shadow* + 安卓 elevation */
  const setShadow = (value) => {
    const shadows = splitTop(value, ',')
    if (shadows.length > 1) {
      note(`box-shadow 有 ${shadows.length} 层，RN 只支持一层，已取第一层`)
    }
    const first = shadows[0]
    if (!first || first === 'none') return
    if (/\binset\b/i.test(first)) {
      note('RN 不支持内阴影（inset），需要的话用图片或叠一层半透明 View')
      return
    }
    const tokens = splitTop(first, ' ')
    const colorToken = tokens.find(isColorToken)
    const lens = tokens.filter((t) => !isColorToken(t) && parseLen(t, ctx))
    const [offsetX = '0', offsetY = '0', blur = '0', spread] = lens
    if (spread && parseFloat(spread) !== 0) {
      note('box-shadow 的 spread（扩散半径）RN 不支持，已忽略')
    }
    set('shadowColor', colorToken ? color(colorToken) : "'#000000'")
    set('shadowOpacity', '1')
    set('shadowRadius', bare(blur, ctx) || '0')
    set('shadowOffset', `{width: ${bare(offsetX, ctx) || '0'}, height: ${bare(offsetY, ctx) || '0'}}`)
    const blurPx = parseLen(blur, ctx)
    const elevation = blurPx && blurPx.px ? Math.max(1, Math.round(blurPx.px / 5)) : 1
    set('elevation', String(elevation))
    comments.set('elevation', '安卓阴影按 blur/5 估的，真机上按需微调')
  }

  /** transform → RN 的数组写法 */
  const setTransform = (value) => {
    const items = []
    for (const fn of splitTop(value, ' ')) {
      const m = /^([a-z]+)\(([^)]*)\)$/i.exec(fn)
      if (!m) continue
      const name = m[1].toLowerCase()
      const args = splitTop(m[2], ',')
      if (name === 'translate') {
        items.push(`{translateX: ${len(args[0], ctx) || '0'}}`)
        if (args[1]) items.push(`{translateY: ${len(args[1], ctx) || '0'}}`)
      } else if (name === 'translatex' || name === 'translatey') {
        items.push(`{translate${name.endsWith('x') ? 'X' : 'Y'}: ${len(args[0], ctx) || '0'}}`)
      } else if (name === 'rotate' || name === 'rotatex' || name === 'rotatey' || name === 'rotatez') {
        const key = name === 'rotate' ? 'rotate' : `rotate${name.slice(-1).toUpperCase()}`
        items.push(`{${key}: '${args[0]}'}`)
      } else if (name === 'scale') {
        items.push(`{scale: ${parseFloat(args[0])}}`)
        if (args[1] && parseFloat(args[1]) !== parseFloat(args[0])) {
          items.pop()
          items.push(`{scaleX: ${parseFloat(args[0])}}`, `{scaleY: ${parseFloat(args[1])}}`)
        }
      } else if (name === 'scalex' || name === 'scaley') {
        items.push(`{scale${name.slice(-1).toUpperCase()}: ${parseFloat(args[0])}}`)
      } else if (name === 'skewx' || name === 'skewy') {
        items.push(`{skew${name.slice(-1).toUpperCase()}: '${args[0]}'}`)
      } else {
        note(`transform 的 ${name}() RN 不支持，已忽略`)
      }
    }
    if (items.length) set('transform', `[${items.join(', ')}]`)
  }

  for (const [rawKey, rawValue] of Object.entries(style)) {
    const key = rawKey.toLowerCase()
    const value = resolveVarFallbacks(String(rawValue).trim())
    if (!value || DROP_SILENT.has(key)) continue

    // reference 模式下真值已被 tempad 抹掉，这里只剩 var(--x)：多数属性会解析失败被丢掉，
    // 所以在入口就告警，别让样式静默消失
    if (value.includes('var(')) {
      note(`${key} 用的是 Figma 变量，但 TemPad 没把真值传给插件：偏好设置里把「变量显示」从 reference 改成 resolved（或 both）`)
    }

    switch (key) {
      // ---------- 布局 ----------
      case 'display': {
        if (value === 'none') set('display', "'none'")
        else if (value === 'grid' || value === 'inline-grid') {
          note('grid 布局要手动改成 flexDirection:row + flexWrap:wrap + 子项固定宽度')
        }
        // display:flex 在 RN 是默认值，但 CSS 的主轴默认是 row、RN 默认是 column，
        // 所以稿子没给 flex-direction 时必须补一个 row，否则布局会竖过来
        if ((value === 'flex' || value === 'inline-flex') && !style['flex-direction']) {
          set('flexDirection', "'row'")
        }
        break
      }
      case 'flex-direction':
      case 'flex-wrap':
      case 'justify-content':
      case 'align-items':
      case 'align-content':
      case 'align-self':
      case 'overflow':
      case 'text-transform':
      case 'pointer-events': {
        const camel = key.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
        if (key === 'overflow' && (value === 'auto' || value === 'scroll')) {
          note('overflow:auto/scroll 在 RN 无效，需要滚动请换 ScrollView / FlatList')
          break
        }
        set(camel, `'${value}'`)
        break
      }
      case 'flex': {
        const parts = splitTop(value, ' ')
        const zeroBasis = parts[2] != null && /^0(%|px)?$/.test(parts[2])
        if (parts.length === 1 && /^[\d.]+$/.test(parts[0])) {
          set('flex', parts[0])
        } else if (zeroBasis && parseFloat(parts[0]) > 0) {
          // Figma 的「填充容器」导出成 flex: 1 0 0，RN 侧惯例直接写 flex: 1
          set('flex', String(parseFloat(parts[0])))
        } else if (value === 'none') {
          set('flexGrow', '0')
          set('flexShrink', '0')
        } else {
          if (parts[0] != null) set('flexGrow', String(parseFloat(parts[0]) || 0))
          if (parts[1] != null) set('flexShrink', String(parseFloat(parts[1]) || 0))
          if (parts[2] != null && parts[2] !== '0%' && parts[2] !== '0') {
            set('flexBasis', len(parts[2], ctx))
          }
        }
        break
      }
      case 'flex-grow':
        set('flexGrow', String(parseFloat(value) || 0))
        break
      case 'flex-shrink':
        set('flexShrink', String(parseFloat(value) || 0))
        break
      case 'flex-basis':
        set('flexBasis', len(value, ctx))
        break
      case 'gap': {
        const parts = splitTop(value, ' ')
        if (parts.length > 1) {
          set('rowGap', len(parts[0], ctx))
          set('columnGap', len(parts[1], ctx))
        } else {
          set('gap', len(parts[0], ctx))
        }
        break
      }
      case 'row-gap':
        set('rowGap', len(value, ctx))
        break
      case 'column-gap':
        set('columnGap', len(value, ctx))
        break
      case 'order':
        note('RN 不支持 order，要改顺序请直接调整 JSX 里子元素的顺序')
        break
      case 'float':
        note('RN 不支持 float，请改成 flex 行 + flexWrap')
        break

      // ---------- 尺寸 ----------
      case 'width':
      case 'height':
      case 'min-width':
      case 'max-width':
      case 'min-height':
      case 'max-height': {
        const camel = key.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
        set(camel, len(value, ctx))
        break
      }
      case 'aspect-ratio': {
        const [w, h] = value.split('/').map((x) => parseFloat(x))
        if (w) set('aspectRatio', h ? n2(w / h) : n2(w))
        break
      }

      // ---------- 间距 / 定位 ----------
      case 'padding':
      case 'margin':
        setBox(key, value)
        break
      case 'padding-top':
      case 'padding-bottom':
      case 'margin-top':
      case 'margin-bottom': {
        const camel = key.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
        set(camel, len(value, ctx))
        break
      }
      case 'padding-left':
        set('paddingStart', len(value, ctx))
        break
      case 'padding-right':
        set('paddingEnd', len(value, ctx))
        break
      case 'padding-inline-start':
        set('paddingStart', len(value, ctx))
        break
      case 'padding-inline-end':
        set('paddingEnd', len(value, ctx))
        break
      case 'margin-left':
        set('marginStart', len(value, ctx))
        break
      case 'margin-right':
        set('marginEnd', len(value, ctx))
        break
      case 'margin-inline-start':
        set('marginStart', len(value, ctx))
        break
      case 'margin-inline-end':
        set('marginEnd', len(value, ctx))
        break
      case 'position': {
        if (value === 'fixed') {
          set('position', "'absolute'")
          note("position:fixed → 已转成 absolute，请挂在页面根 View 上，滚动内容记得补等高 paddingBottom")
        } else if (value === 'sticky') {
          note('RN 没有 position:sticky，列表吸顶用 FlatList 的 stickyHeaderIndices')
        } else if (value === 'absolute' || value === 'relative' || value === 'static') {
          set('position', `'${value === 'static' ? 'relative' : value}'`)
        }
        break
      }
      case 'top':
      case 'bottom':
        set(key, len(value, ctx))
        break
      case 'left':
        set('start', len(value, ctx))
        break
      case 'right':
        set('end', len(value, ctx))
        break
      case 'inset': {
        const parts = splitTop(value, ' ')
        const [a, b = a, c = a, d = b] = parts
        set('top', len(a, ctx))
        set('end', len(b, ctx))
        set('bottom', len(c, ctx))
        set('start', len(d, ctx))
        break
      }
      case 'z-index':
        set('zIndex', String(parseInt(value, 10) || 0))
        break

      // ---------- 背景 / 边框 ----------
      case 'background':
      case 'background-color': {
        if (/gradient\(/i.test(value)) {
          note(`渐变请用 shared/components/Gradient 的 VerticalGradient / HorizontalGradient（原值：${value}）`)
          break
        }
        if (/url\(/i.test(value)) {
          note('背景图请改成 <Image> 或 ImageBackground，并显式写 resizeMode')
          break
        }
        set('backgroundColor', color(value))
        break
      }
      case 'fill':
        set('backgroundColor', color(value))
        note('fill 已按容器底色转成 backgroundColor；若这是图标颜色，请改成 tintColor / color')
        break
      case 'stroke':
        set('borderColor', color(value))
        break
      case 'stroke-width':
        set('borderWidth', len(value, ctx))
        break
      case 'border':
        setBorder('', value)
        break
      case 'border-top':
        setBorder('Top', value)
        break
      case 'border-bottom':
        setBorder('Bottom', value)
        break
      case 'border-left':
        setBorder('Start', value)
        break
      case 'border-right':
        setBorder('End', value)
        break
      case 'border-width':
        set('borderWidth', len(value, ctx))
        break
      case 'border-top-width':
        set('borderTopWidth', len(value, ctx))
        break
      case 'border-bottom-width':
        set('borderBottomWidth', len(value, ctx))
        break
      case 'border-left-width':
        set('borderStartWidth', len(value, ctx))
        break
      case 'border-right-width':
        set('borderEndWidth', len(value, ctx))
        break
      case 'border-color':
        set('borderColor', color(splitTop(value, ' ')[0]))
        break
      case 'border-top-color':
        set('borderTopColor', color(value))
        break
      case 'border-bottom-color':
        set('borderBottomColor', color(value))
        break
      case 'border-left-color':
        set('borderStartColor', color(value))
        break
      case 'border-right-color':
        set('borderEndColor', color(value))
        break
      case 'border-style':
        if (value !== 'solid') set('borderStyle', `'${value}'`)
        break
      case 'border-radius':
        setRadius(value)
        break
      case 'border-top-left-radius':
        set('borderTopStartRadius', len(value, ctx))
        break
      case 'border-top-right-radius':
        set('borderTopEndRadius', len(value, ctx))
        break
      case 'border-bottom-right-radius':
        set('borderBottomEndRadius', len(value, ctx))
        break
      case 'border-bottom-left-radius':
        set('borderBottomStartRadius', len(value, ctx))
        break
      case 'background-clip':
        note('background-clip 无对应写法：常态用 borderWidth + borderColor:"transparent" 占位，选中态换实色')
        break

      // ---------- 阴影 / 滤镜 ----------
      case 'box-shadow':
        setShadow(value)
        break
      case 'opacity':
        set('opacity', n2(parseFloat(value)))
        break
      case 'filter':
      case 'backdrop-filter':
        note(`RN 不支持 ${key}（原值：${value}），毛玻璃要用原生模糊组件或直接切图`)
        break
      case 'mix-blend-mode':
      case 'background-blend-mode':
        note(`RN 不支持 ${key}，请让设计给合成后的颜色或切图`)
        break
      case 'transform':
        setTransform(value)
        break
      case 'transform-origin':
        note('RN 的变换原点固定在中心，transform-origin 请用额外的 translate 抵消')
        break

      // ---------- 文字 ----------
      case 'color':
        set('color', color(value))
        break
      case 'font-size':
        set('fontSize', len(value, ctx))
        break
      case 'font-weight': {
        const mapped = FONT_WEIGHT_MAP[value.toLowerCase()] || value.replace(/\D/g, '')
        if (mapped) set('fontWeight', `'${mapped}'`)
        break
      }
      case 'font-style':
        if (value === 'italic' || value === 'oblique') set('fontStyle', "'italic'")
        break
      case 'line-height': {
        if (value === 'normal') break
        const pct = /^([\d.]+)%$/.exec(value)
        if (pct && fontSizePx) {
          set('lineHeight', `s(${Math.round((fontSizePx * parseFloat(pct[1])) / 100)})`)
          break
        }
        if (/^[\d.]+$/.test(value) && fontSizePx) {
          set('lineHeight', `s(${n2(Math.round(fontSizePx * parseFloat(value)))})`)
          break
        }
        set('lineHeight', len(value, ctx))
        break
      }
      case 'letter-spacing': {
        if (value === 'normal') break
        const pct = /^(-?[\d.]+)%$/.exec(value)
        if (pct && fontSizePx) {
          set('letterSpacing', `s(${n2(Math.round(fontSizePx * parseFloat(pct[1])) / 100)})`)
          break
        }
        set('letterSpacing', len(value, ctx))
        break
      }
      case 'text-align': {
        const mapped = value === 'start' ? 'left' : value === 'end' ? 'right' : value
        set('textAlign', `'${mapped}'`)
        break
      }
      case 'text-decoration':
      case 'text-decoration-line': {
        const lines = []
        if (/underline/.test(value)) lines.push('underline')
        if (/line-through/.test(value)) lines.push('line-through')
        if (lines.length) set('textDecorationLine', `'${lines.join(' ')}'`)
        break
      }
      case 'text-shadow': {
        const tokens = splitTop(splitTop(value, ',')[0], ' ')
        const colorToken = tokens.find(isColorToken)
        const lens = tokens.filter((t) => !isColorToken(t) && parseLen(t, ctx))
        set('textShadowColor', colorToken ? color(colorToken) : "'#000000'")
        set('textShadowOffset', `{width: ${bare(lens[0], ctx) || '0'}, height: ${bare(lens[1], ctx) || '0'}}`)
        set('textShadowRadius', bare(lens[2], ctx) || '0')
        break
      }
      case 'text-overflow':
        if (value === 'ellipsis' && !style['-webkit-line-clamp']) {
          note('文本省略用 <Text numberOfLines={1}>，父容器要有明确宽度约束')
        }
        break
      case '-webkit-line-clamp':
        note(`文本省略用 <Text numberOfLines={${value}}>，别用 CSS 的 line-clamp`)
        break
      case 'direction':
      case 'writing-mode':
        break

      default: {
        const camel = key.replace(/^-+/, '').replace(/-([a-z])/g, (_, c) => c.toUpperCase())
        unknown.push(`// ${camel}: ${len(value, ctx) || `'${value}'`}, // ${key} 未做映射，请确认 RN 是否支持`)
        break
      }
    }
  }

  // 仓库硬性要求：每个 Text 都要有 lineHeight，且不能小于 fontSize（否则安卓裁字形下沿）
  if (props.has('fontSize') && fontSizePx) {
    const lh = /^s\((-?[\d.]+)\)$/.exec(props.get('lineHeight') || '')
    if (!props.has('lineHeight')) {
      props.set('lineHeight', `s(${n2(fontSizePx + 8)})`)
      note('稿上没标行高，lineHeight 按 fontSize + 8 兜底（仓库约定）')
    } else if (lh && parseFloat(lh[1]) < fontSizePx) {
      props.set('lineHeight', `s(${n2(fontSizePx)})`)
      comments.set('lineHeight', `稿上是 ${String(style['line-height']).trim()}，小于字号会被安卓裁掉下沿，已抬到 fontSize`)
    }
  }

  return { props, notes, comments, unknown }
}

/** 按 ORDER 排序，未收录的属性排到最后 */
function sortProps(props) {
  return [...props.entries()].sort((a, b) => {
    const ia = ORDER.indexOf(a[0])
    const ib = ORDER.indexOf(b[0])
    return (ia === -1 ? ORDER.length : ia) - (ib === -1 ? ORDER.length : ib)
  })
}

export default definePlugin({
  name: 'Timo RN',
  code: {
    rn: {
      title: 'RN Style',
      lang: 'ts',
      transform({ style, options }) {
        const ctx = { rootFontSize: (options && options.rootFontSize) || 16 }
        const { props, notes, comments, unknown } = toRNStyle(style || {}, ctx)
        if (!props.size && !notes.length && !unknown.length) return '无'

        const sorted = sortProps(props)
        const container = sorted.filter(([key]) => !TEXT_KEYS.has(key))
        const text = sorted.filter(([key]) => TEXT_KEYS.has(key))
        const line = ([key, code]) => {
          const tip = comments.get(key)
          return `${key}: ${code},${tip ? ` // ${tip}` : ''}`
        }
        const lines = notes.map((n) => `// ⚠ ${n}`)

        container.forEach((entry) => lines.push(line(entry)))
        // 容器样式和文字样式通常要拆成两个 StyleSheet 条目，给条分隔线好下刀
        if (container.length && text.length) lines.push('// 文字')
        text.forEach((entry) => lines.push(line(entry)))
        unknown.forEach((l) => lines.push(l))

        return lines.join('\n')
      }
    },
    // 内置 css 块在 tempad-dev 的 worker 里是硬编码排在自定义块之前的
    // （codegen/worker.ts：component → css → js → ...Object.keys(rest)），
    // 想让 RN Style 排在上面，只能关掉内置块、用自定义块补一个同样的 CSS。
    // 自定义块不给 transform 时走的是同一个 serializeCSS，输出与内置块一致。
    cssRaw: {
      title: 'CSS',
      lang: 'css'
    },
    css: false,
    js: false
  }
})
