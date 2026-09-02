# TemPad Dev 插件集

给 [TemPad Dev](https://github.com/ecomfe/tempad-dev) 用的两个样式转换插件：H5（Stylus/CSS）与 React Native。

| 插件        | 用途                            | 插件地址                                                          |
| ----------- | ------------------------------- | ----------------------------------------------------------------- |
| **Timo UI** | H5 项目（Stylus mixin + CSS）   | `https://vivid05.github.io/tempad-dev-plugin/dist/plugin.mjs`     |
| **Timo RN** | rn-store 仓库（RN StyleSheet）  | `https://vivid05.github.io/tempad-dev-plugin/dist/plugin-rn.mjs`  |

TemPad Dev 一次只加载一个插件，写 H5 用上面那个、切图到 RN 用下面那个。

---

## Timo UI（H5）

### Font 块 (SCSS)

- 自动组合 `font-size`、`color`、`line-height`、`font-weight` 为 Stylus mixin 格式
- 没有字体属性时显示"无"

### Style 块 (CSS)

- 将 `fill` 转换为 `background-color`
- 将 `stroke-width` 和 `stroke` 组合为 `border`
- 自动过滤 `font-family` 和 `font-style` 属性
- 输出标准 CSS 格式

---

## Timo RN（React Native）

面板里出现 **RN Style** 块，直接产出能贴进 `StyleSheet.create({ ... })` 的属性行；下面的 **CSS** 块保留 Figma 原始 CSS 方便对照。

转换规则对齐 rn-store 仓库的 `rn-ui-from-design` skill 与 withdraw 模块现有代码：

### 尺寸

- Figma 画板基准宽 **750**，px 数值 1:1 包一层 `s()`：`width: 332px` → `width: s(332)`
- 换成 375 稿时，改 `src/plugin-rn.js` 顶部的 `DESIGN_SCALE = 2` 重新 build
- `0`、百分比、`flex`、`opacity`、`zIndex`、阴影的 offset/radius **不包** `s()`（阴影这条是照仓库现有写法）

### RTL（自动转逻辑属性）

| CSS                                        | RN                                                              |
| ------------------------------------------ | --------------------------------------------------------------- |
| `margin-left` / `padding-right`            | `marginStart` / `paddingEnd`                                    |
| `left` / `right`                           | `start` / `end`                                                 |
| `border-top-left-radius`                   | `borderTopStartRadius`                                          |
| `padding: 12px 32px 12px 24px`             | `paddingTop` / `paddingEnd` / `paddingBottom` / `paddingStart`   |
| `border-radius: 0 32px 0 32px`             | 四个 `borderTop/BottomStart/EndRadius`                          |

### 布局

- `display:flex` 且稿子没给 `flex-direction` → 自动补 `flexDirection: 'row'`（CSS 主轴默认 row，RN 默认 column，这里最容易踩）
- Figma 的「填充容器」`flex: 1 0 0` → `flex: 1`
- `padding` / `margin` / `inset` 简写按 1/2/3/4 值展开成 `Vertical`、`Horizontal` 或四边
- `gap: 16px 24px` → `rowGap` / `columnGap`
- `display:grid`、`order`、`float`、`overflow:scroll` → 转成提示，让你手动改 flex

### 文字

- `line-height: 120%` 按 `font-size` 换算并取整成 `s(48)`；`normal` 兜底成 `fontSize + 8`；换算结果小于字号时抬到 `fontSize`（否则安卓裁字形下沿）
- `letter-spacing: -2%` 同样按 `font-size` 换算
- `font-weight: bold` → `'700'`（一律字符串）
- `font-family` / `font-style: normal` 丢弃（仓库不指定字体族）
- `text-overflow` / `-webkit-line-clamp` → 提示改用 `numberOfLines`
- 容器样式与文字样式之间插一行 `// 文字` 分隔，方便拆成两个 StyleSheet 条目

### 阴影 / 边框

- `box-shadow: 0 8px 24px rgba(0,0,0,.08)` → `shadowColor`（保留 rgba）+ `shadowOpacity: 1` + `shadowRadius` + `shadowOffset` + `elevation`
- `elevation` 按 `blur / 5` 估算，行尾带注释提醒真机微调
- 多层阴影只取第一层、`inset` 内阴影转提示（RN 都不支持）
- `border: 2px solid #FFF` → `borderWidth` + `borderColor`，`solid` 省略、`dashed` 额外提醒安卓不稳

### RN 不支持的会转成 `// ⚠` 提示，而不是硬塞属性

渐变（指向 `shared/components/Gradient`）、`backdrop-filter`、`filter`、`mix-blend-mode`、`background-clip`、`position:sticky`、`transform-origin`、内阴影。
没做映射的属性（如 `mask-image`）会以**注释行**形式输出，不污染样式也不悄悄丢信息。

### 还需要人工做的两件事

1. **色值**：输出的是归一化后的字面量（`#8f5` → `'#88FF55'`）。仓库禁止组件里散写 hex，出现 ≥2 次的要挪进模块 `constants/theme.ts` 的 `colors`。
2. **`fill`**：按容器底色转成了 `backgroundColor`，如果这其实是图标颜色，改成 `tintColor` / `color`。

---

## 本地开发

```bash
# 安装依赖
npm install

# 构建（产出 dist/plugin.mjs 与 dist/plugin-rn.mjs）
npm run build

# 启动 HTTPS 开发服务器（会同时打印两个插件地址）
node dev-server.js
```

## 目录

- `src/plugin.js` - Timo UI（H5）插件源码
- `src/plugin-rn.js` - Timo RN 插件源码
- `dist/*.mjs` - 构建产物
- `build.config.js` - unbuild 配置
- `dev-server.js` - HTTPS 开发服务器

## License

MIT
