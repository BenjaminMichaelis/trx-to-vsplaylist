import commonjs from '@rollup/plugin-commonjs';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import json from '@rollup/plugin-json';

const shared = {
  output: { esModule: true, format: 'es', sourcemap: true },
  plugins: [commonjs(), nodeResolve({ preferBuiltins: true }), json()],
};

export default [
  {
    ...shared,
    input: 'src/index.js',
    output: { ...shared.output, file: 'dist/index.js' },
  },
  {
    ...shared,
    input: 'src/post.js',
    output: { ...shared.output, file: 'dist/post.js' },
  },
];
