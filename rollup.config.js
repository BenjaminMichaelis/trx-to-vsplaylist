import commonjs from '@rollup/plugin-commonjs';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import json from '@rollup/plugin-json';
import typescript from '@rollup/plugin-typescript';

const shared = {
  output: { esModule: true, format: 'es', sourcemap: true },
  plugins: [
    typescript(),
    commonjs(),
    nodeResolve({ preferBuiltins: true }),
    json(),
  ],
};

export default [
  {
    ...shared,
    input: 'src/index.ts',
    output: { ...shared.output, file: 'dist/index.js' },
  },
  {
    ...shared,
    input: 'src/post.ts',
    output: { ...shared.output, file: 'dist/post.js' },
  },
];
