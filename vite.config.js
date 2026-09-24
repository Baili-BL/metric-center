import fs from 'node:fs'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

function patchYahei(code) {
  return code
    .replaceAll('"".concat(fontarray[0], ",").concat(fontSet)', '"微软雅黑,".concat(fontSet)')
    .replaceAll('var current = fontarray[0];', 'var current = "微软雅黑";')
    .replaceAll(
      'pt \\"Helvetica Neue\\", Helvetica, Arial, \\"PingFang SC\\", \\"Hiragino Sans GB\\", \\"Heiti SC\\",  \\"WenQuanYi Micro Hei\\", sans-serif',
      'pt \\"微软雅黑\\", \\"Microsoft YaHei\\", Helvetica, Arial, \\"PingFang SC\\", sans-serif',
    )
    .replaceAll(
      '\\"Helvetica Neue\\", Helvetica, Arial, \\"PingFang SC\\", \\"Hiragino Sans GB\\", \\"Heiti SC\\", \\"Microsoft YaHei\\", \\"WenQuanYi Micro Hei\\", sans-serif',
      '\\"微软雅黑\\", \\"Microsoft YaHei\\", Helvetica, Arial, \\"PingFang SC\\", sans-serif',
    )
}

function fortuneYahei() {
  return {
    name: 'fortune-yahei',
    enforce: 'pre',
    transform(code, id) {
      if (!id.includes('@fortune-sheet')) return null
      const next = patchYahei(code)
      return next === code ? null : next
    },
  }
}

const fortuneYaheiEsbuild = {
  name: 'fortune-yahei',
  setup(build) {
    build.onLoad({ filter: /@fortune-sheet[/\\].*index\.(esm\.)?js$/ }, (args) => {
      const code = patchYahei(fs.readFileSync(args.path, 'utf8'))
      return { contents: code, loader: 'js' }
    })
  },
}

export default defineConfig({
  plugins: [fortuneYahei(), vue()],
  optimizeDeps: {
    include: ['react', 'react-dom', '@fortune-sheet/react'],
    esbuildOptions: { plugins: [fortuneYaheiEsbuild] },
  },
})
