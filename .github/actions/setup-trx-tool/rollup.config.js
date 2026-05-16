const commonjs = require('@rollup/plugin-commonjs')
const resolve = require('@rollup/plugin-node-resolve')

module.exports = {
  input: {
    index: 'src/main.js',
    post: 'src/post.js'
  },
  output: {
    dir: 'dist',
    format: 'cjs',
    chunkFileNames: '[name].js'
  },
  plugins: [resolve(), commonjs()]
}
