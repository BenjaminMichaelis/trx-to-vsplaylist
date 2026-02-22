import commonjs from '@rollup/plugin-commonjs'
import { nodeResolve } from '@rollup/plugin-node-resolve'

const config = [
  {
    input: 'src/pre.js',
    output: {
      esModule: true,
      file: 'dist/pre.js',
      format: 'es',
      sourcemap: true
    },
    plugins: [commonjs(), nodeResolve({ preferBuiltins: true })]
  },
  {
    input: 'src/main.js',
    output: {
      esModule: true,
      file: 'dist/main.js',
      format: 'es',
      sourcemap: true
    },
    plugins: [commonjs(), nodeResolve({ preferBuiltins: true })]
  }
]

export default config
