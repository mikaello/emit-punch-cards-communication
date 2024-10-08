const { src, dest, series, watch, task } = require("gulp");
const ts = require("typescript");
const rollup = require("rollup");
const typescriptPlugin = require("@rollup/plugin-typescript");
const { nodeResolve } = require("@rollup/plugin-node-resolve");
const through2 = require("through2");
const fs = require("fs");
const json5 = require("json5");

const LIB_SOURCE = "../src/**/*.ts";
const tsConfigPath = "../tsconfig.json";

// Read and parse tsconfig.json with json5
const tsConfig = json5.parse(fs.readFileSync(tsConfigPath, "utf-8"));

const transpileLibTypescript = () =>
  src(LIB_SOURCE, { sourcemaps: true })
    .pipe(through2.obj(function (file, _, cb) {
      if (file.isBuffer()) {
        const result = ts.transpileModule(file.contents.toString(), {
          compilerOptions: tsConfig.compilerOptions,
          fileName: file.path,
        });
        file.contents = Buffer.from(result.outputText);
      }
      cb(null, file);
    }))
    .pipe(dest("../dist", { sourcemaps: '.' }));

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
