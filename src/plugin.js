import { definePlugin } from '@tempad-dev/plugins'

export default definePlugin({
  name: 'Timo UI',
  code: {
    font: {
      title: 'Font',
      lang: 'scss',
      transform({ style }) {
        const fontSize = style['font-size']
        const color = style.color
        const lineHeight = style['line-height']
        const fontWeight = style['font-weight']

        // 检查是否有任何字体属性
        const hasFontProps = fontSize || color || lineHeight || fontWeight

        if (!hasFontProps) {
          return '无'
        }

        return `@include font(${fontSize}, ${color}, ${lineHeight}, ${fontWeight});`
      }
    },
    css: {
      title: 'Style', // 自定义代码块标题
      lang: 'css', // 自定义语法高亮语言
      transform({ style }) {
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