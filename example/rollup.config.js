import typescript from "@rollup/plugin-typescript";
import { nodeResolve } from "@rollup/plugin-node-resolve";

/**
 * @type {import('rollup').RollupOptions}
 */
export default {
  input: "./helper.ts",
  output: {
    dir: "dist",
    format: "esm",
    sourcemap: true,
  },
  plugins: [nodeResolve(), typescript()],
};
