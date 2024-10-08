const { src, dest, series, watch, task } = require("gulp");
const ts = require("typescript");
const rollup = require("rollup");
const typescriptPlugin = require("@rollup/plugin-typescript");
const { nodeResolve } = require("@rollup/plugin-node-resolve");

const LIB_SOURCE = "../src/**/*.ts";
const tsConfigPath = "../tsconfig.json";

const transpileLibTypescript = () =>
  src(LIB_SOURCE, { sourcemaps: true }) // initialize sourcemaps
    .pipe(dest("../dist", { sourcemaps: "." })); // write sourcemaps to the same directory

function compileTypeScript(content, file) {
  const tsConfig = require(tsConfigPath);
  const result = ts.transpileModule(content.toString(), {
    compilerOptions: tsConfig.compilerOptions,
    fileName: file.path,
  });
  return result.outputText;
}

const buildExample = (done) =>
  rollup
    .rollup({
      input: "./helper.ts",
      plugins: [nodeResolve(), typescriptPlugin()],
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
