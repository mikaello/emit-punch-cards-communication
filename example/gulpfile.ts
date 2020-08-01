const { src, dest, series, watch, task } = require("gulp");
const ts = require("gulp-typescript");
const rollup = require("rollup");
const typescript = require("rollup-plugin-typescript2");
const resolve = require("@rollup/plugin-node-resolve");

const tsProjectLib = ts.createProject("../tsconfig.json", {
  rootDir: "../",
});
const LIB_SOURCE = "../src/**/*.ts";

const transpileLibTypescript = () =>
  src(LIB_SOURCE).pipe(tsProjectLib()).pipe(dest("../dist"));

const buildExample = (done: () => void) =>
  rollup
    .rollup({
      input: "./helper.ts",
      plugins: [resolve(), typescript()],
    })
    .then((bundle) =>
      bundle.write({
        dir: "dist",
        format: "esm",
        sourcemap: true,
      }),
    )
    .then(() => {
      done();
    });

const copyHtml = () => src("*.html").pipe(dest("./dist"));

task("default", () => {
  watch("*.html", copyHtml);
  watch(LIB_SOURCE, transpileLibTypescript);
  watch(
    [
      "*.ts",
      "node_modules/@mikaello/emit-punch-cards-communication/dist/**/*.js",
    ],
    buildExample,
  );
});

task("prestart", series(transpileLibTypescript, buildExample, copyHtml));
