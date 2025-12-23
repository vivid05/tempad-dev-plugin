import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  entries: ['src/plugin'],
  clean: true,
  failOnWarn: false,
  rollup: {
    inlineDependencies: true,
    esbuild: {
      minify: true,
    },
  },
})

