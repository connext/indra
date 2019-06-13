import typescript from "rollup-plugin-typescript2";

import pkg from "../package.json";

export default {
  input: "src/main.ts",
  output: [
    {
      file: pkg.main,
      sourcemap: true,
      format: "cjs"
    }
  ],
  external: [ ...Object.keys(pkg.dependencies || {}) ],
  plugins: [ typescript() ]
};
