// 实现这个项目的构建任务
const {
  src,
  dest,
  parallel,
  series,
  watch,
} = require("gulp");
const path = require('path')
const Comb = require('csscomb')
const standard = require('standard')
const loadPlugins = require("gulp-load-plugins");
const plugins = loadPlugins();
const del = require("del");
const browserSync = require("browser-sync");
const config = require('./pages.config');
const bs = browserSync.create();
const minimist = require('minimist')
const argv = minimist(process.argv.slice(2))
const isProd = process.env.NODE_ENV ?
  process.env.NODE_ENV === 'production' :
  argv.production || argv.prod || false

const cwd = process.cwd();

const clean = () => {
  return del([config.build.dist, config.build.temp]);
};

const lint = done => {
  const comb = new Comb(require('./csscomb.json'))
  comb.processPath(config.build.src)
  const cwd = path.join(__dirname, config.build.src)
  standard.lintFiles(config.build.paths.scripts, {
    cwd,
    fix: true
  }, done)
}

const style = () => {
  return src(config.build.paths.styles, {
      base: config.build.src,
      cwd: config.build.src,
    })
    .pipe(plugins.sass({
      outputStyle: "expanded",
    }))
    .pipe(dest(config.build.temp))
    .pipe(bs.reload({
      stream: true,
    }));
};

const script = () => {
  return src(config.build.paths.scripts, {
      base: config.build.src,
      cwd: config.build.src,
    })
    .pipe(plugins.babel({
      presets: [require("@babel/preset-env")],
    }))
    .pipe(dest(config.build.temp))
    .pipe(bs.reload({
      stream: true,
    }));
};

const page = () => {
  return src(config.build.paths.pages, {
      base: config.build.src,
      cwd: config.build.src,
    })
    .pipe(plugins.swig({
      data: config.data,
      defaults: {
        cache: false,
      },
    }))
    .pipe(dest(config.build.temp))
    .pipe(bs.reload({
      stream: true,
    }));
};

const image = () => {
  return src(config.build.paths.images, {
      base: config.build.src,
      cwd: config.build.src,
    })
    .pipe(plugins.imagemin())
    .pipe(dest(config.build.dist));
};

const font = () => {
  return src(config.build.paths.fonts, {
      base: config.build.src,
      cwd: config.build.src,
    })
    .pipe(plugins.imagemin())
    .pipe(dest(config.build.dist));
};

const extra = () => {
  return src("public/**", {
      base: "public",
    })
    .pipe(dest(config.build.dist));
};

const server = () => {
  watch(config.build.paths.styles, {
    cwd: config.build.src,
  }, style);
  watch(config.build.paths.scripts, {
    cwd: config.build.src,
  }, script);
  watch(config.build.paths.pages, {
    cwd: config.build.src,
  }, page);
  // watch('src/assets/images/**', image)
  // watch('src/assets/fonts/**', font)
  watch([
    config.build.paths.images,
    config.build.paths.fonts,
  ], {
    cwd: config.build.src,
  }, bs.reload());
  watch("**", {
    cwd: config.build.public
  }, bs.reload);
  bs.init({
    notify: false,
    port: argv.port === undefined ? 2080 : argv.port,
    open: argv.open === undefined ? false : argv.open,
    // files: 'dist/**',
    server: {
      baseDir: ["temp", "src", "public"],
      routes: {
        "/node_modules": "node_modules",
      },
    },
  });
};

const upload = () => {
  console.log(argv.branch)
  return src('dist/**')
    .pipe(
      plugins.ghPages([{
        branch: argv.branch === undefined ? 'gh-pages' : argv.branch
      }])
    )
}

const useref = () => {
  return src("temp/*.html", {
      base: "temp",
    })
    .pipe(plugins.useref({
      searchPath: ["temp", "."],
    }))
    .pipe(plugins.if(/.js$/, plugins.uglify()))
    .pipe(plugins.if(/.css$/, plugins.cleanCss()))
    .pipe(plugins.if(/.html$/, plugins.htmlmin({
      collapseWhitespace: true,
      minifyCSS: true,
      minifyJS: true,
    })))
    .pipe(dest(config.build.dist));
};

const distServer = () => {
  bs.init({
    notify: false,
    port: argv.port === undefined ? 2080 : argv.port,
    open: argv.open === undefined ? false : argv.open,
    server: config.build.dist
  })
}

const measure = () => {
  return src('**', {
      cwd: config.build.dist
    })
    .pipe(
      plugins.size({
        title: `${isProd ? 'Prodcuction' : 'Development'} mode build`,
        gzip: true
      })
    )
}

const compile = parallel(style, script, page);
const build = series(
  clean,
  parallel(
    series(compile, useref),
    image,
    font,
    extra,
  ),
  measure
);
const serve = series(compile, server);
const start = series(build, distServer)
const deploy = series(build, upload)
module.exports = {
  lint,
  compile,
  serve,
  build,
  start,
  deploy,
  clean,
};
/*
演示命令：
yarn lint
yarn compile
yarn serve
yarn serve --port=8866 --open
yarn build
yarn build --production
yarn start --port=8866 --open
yarn deploy
yarn clean
*/
