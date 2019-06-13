import babel from 'rollup-plugin-babel';
import commonjs from "rollup-plugin-commonjs";
import resolve from 'rollup-plugin-node-resolve';
import typescript from "rollup-plugin-typescript2";

import pkg from "../package.json";

export default {
  input: "src/main.ts",
  output: [{
    file: 'dist/bundle.js',
    format: "umd",
    name: "IndraV2Node",
  }],
  // external: [ ...Object.keys(pkg.dependencies || {}) ],
  plugins: [

    commonjs({
      include: [ "./src/main.ts", "node_modules/**" ],
      ignoreGlobal: false,
      namedExports: {
        '@nestjs/common': ['Injectable'],
      },
    }),

    typescript(),

    resolve({
      preferBuiltins: true,
      jsnext: true,
      main: true,
      browser: true,
    }),

  ]
};
