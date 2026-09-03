import { definePlugin } from '@tempad-dev/plugins'

/** 变量显示为 'both' 时值形如 `var(--x, #74777A)`，取出 fallback 里的真值 */
function resolveVarFallbacks(style) {
  const next = {}
  for (const [key, value] of Object.entries(style)) {
    next[key] = String(value).replace(
      /var\(\s*--[^,()]+,\s*([^()]*(?:\([^()]*\)[^()]*)*)\)/g,
      (_, fallback) => fallback.trim()
    )
  }
  return next
}

// 注：不要挂 transformVariable。挂了它 tempad 会把 style 换成 pluginVariableStyle，
// 而那份里绑定了变量的属性会被无条件覆盖成不带 fallback 的 var(--x)，真值反而丢了。
// 变量真值靠 TemPad 偏好设置里的「变量显示」= resolved / both 下发。

export default definePlugin({
  name: 'Timo UI',
  code: {
    font: {
      title: 'Font',
      lang: 'scss',
      transform({ style: rawStyle }) {
        const style = resolveVarFallbacks(rawStyle)
        // 顺序即 mixin 的参数顺序，不能调
        const args = [style['font-size'], style.color, style['line-height'], style['font-weight']]

        // 检查是否有任何字体属性
        if (!args.some(Boolean)) {
          return '无'
        }

        // 缺的参数不能直接插值，否则输出字面量 undefined。
        // 末尾缺的直接不传（走 mixin 默认值）；中间缺的用 null 占位，保证后面的参数不串位。
        while (args.length && !args[args.length - 1]) {
          args.pop()
        }

        return `@include font(${args.map((arg) => arg || 'null').join(', ')});`
      }
    },
    css: {
      title: 'Style', // 自定义代码块标题
      lang: 'css', // 自定义语法高亮语言
      transform({ style: rawStyle }) {
        const style = resolveVarFallbacks(rawStyle)
        const fontProps = ['font-size', 'color', 'line-height', 'font-weight']
        const strokeProps = ['stroke-width', 'stroke']
        const filteredProps = ['font-family', 'font-style'] // 需要过滤掉的属性
        const processedProps = new Set()
        const result = []

        // 将字体属性和过滤属性都添加到已处理集合中（由 font 块处理）
        fontProps.forEach(prop => processedProps.add(prop))
        filteredProps.forEach(prop => processedProps.add(prop))

        // 处理 stroke 属性组合成 border
        if (style['stroke-width'] && style['stroke']) {
          const strokeWidth = style['stroke-width']
          const stroke = style['stroke']
          result.push(`border: ${strokeWidth} solid ${stroke};`)
          strokeProps.forEach(prop => processedProps.add(prop))
        } else if (style['stroke-width']) {
          // 只有 stroke-width，保持原样
          result.push(`stroke-width: ${style['stroke-width']};`)
          processedProps.add('stroke-width')
        } else if (style['stroke']) {
          // 只有 stroke，保持原样
          result.push(`stroke: ${style['stroke']};`)
          processedProps.add('stroke')
        }

        // 处理其他属性
        Object.entries(style).forEach(([key, value]) => {
          if (processedProps.has(key)) {
            return
          }

          // fill 替换为 background-color
          if (key === 'fill') {
            result.push(`background-color: ${value};`)
          } else {
            result.push(`${key}: ${value};`)
          }
        })

        return result.join('\n')
      }
    },
    js: false // 隐藏内置的 JavaScript 代码块
  }
})