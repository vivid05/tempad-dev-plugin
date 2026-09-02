import { defineBuildConfig } from 'unbuild'

/**
 * 两个入口拆成两次独立构建：放在同一次构建里，rollup 会把两个入口共用的
 * definePlugin 抽成 dist/shared/*.mjs 共享 chunk，产物变成 import './shared/...'，
 * 从 URL 加载插件时会多一跳相对请求。拆开构建保证每个 .mjs 都是自包含的。
 */
const shared = {
  clean: false,
  failOnWarn: false,
  rollup: {
    inlineDependencies: true,
    esbuild: {
      minify: true,
    },
  },
}

export default defineBuildConfig([
  { ...shared, entries: ['src/plugin'], clean: true },
  { ...shared, entries: ['src/plugin-rn'] },
])
