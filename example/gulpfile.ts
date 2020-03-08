const { src, dest, series, watch, task } = require("gulp");
const ts = require("gulp-typescript");

const tsProject = ts.createProject("tsconfig.json");
const tsProjectLib = ts.createProject("tsconfig.json", { rootDir: "../" });

const TRANSPILED_FOLDER = "dist";

const transpileTypescript = (files: string, project: any) =>
  src(files)
    .pipe(project())
    .pipe(dest(TRANSPILED_FOLDER));

const transpileLib = () => transpileTypescript("../*.ts", tsProjectLib);
const transpileHelpers = () => transpileTypescript("*.ts", tsProject);

const copyHtml = () => src("*.html").pipe(dest("./dist"));

task("default", () => {
  watch("*.html", copyHtml);
  watch("../*.ts", transpileLib);
  watch("*.ts", transpileHelpers);
});

task("prestart", series(copyHtml, transpileLib, transpileHelpers));
