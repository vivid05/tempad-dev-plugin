# Timo UI Plugin

一个用于 [TemPad Dev](https://github.com/ecomfe/tempad-dev) 的插件，提供 Timo UI 样式转换功能。

## 功能特性

### Font 块 (SCSS)
- 自动组合 `font-size`、`color`、`line-height`、`font-weight` 为 Stylus mixin 格式
- 没有字体属性时显示"无"

### Style 块 (CSS)
- 将 `fill` 转换为 `background-color`
- 将 `stroke-width` 和 `stroke` 组合为 `border`
- 自动过滤 `font-family` 和 `font-style` 属性
- 输出标准 CSS 格式

## 使用方式

### 通过 CDN 引入

```javascript
// 通过 GitHub Pages 访问
https://vivid05.github.io/tempad-dev-plugin/dist/plugin.mjs
```

### 本地开发

```bash
# 安装依赖
npm install

# 构建项目
npm run build

# 启动 HTTPS 开发服务器
node dev-server.js
```

## 开发

- `src/plugin.js` - 插件源代码
- `dist/plugin.mjs` - 构建后的插件文件
- `build.config.js` - unbuild 配置
- `dev-server.js` - HTTPS 开发服务器

## License

MIT

