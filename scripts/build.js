const Path = require('path');
const Chalk = require('chalk');
const FileSystem = require('fs');
const Vite = require('vite');
const compileTs = require('./private/tsc');

function buildRenderer() {
  return Vite.build({
    configFile: Path.join(__dirname, '..', 'vite.config.ts'),
    base: './',
    mode: 'production',
  });
}

function buildMain() {
  copyIconsSync();

  const mainPath = Path.join(__dirname, '..', 'src', 'main');
  return compileTs(mainPath);
}

FileSystem.rmSync(Path.join(__dirname, '..', 'build'), {
  recursive: true,
  force: true,
});

function copyIconsSync() {
  FileSystem.cpSync(
    Path.join(__dirname, '..', 'src', 'icons'),
    Path.join(__dirname, '..', 'build'),
    { recursive: true },
    err => {
      console.log(err);
    },
  );
}

console.log(Chalk.blueBright('Transpiling renderer & main...'));

Promise.allSettled([buildRenderer(), buildMain()]).then(() => {
  console.log(
    Chalk.greenBright(
      'Renderer & main successfully transpiled! (ready to be built with electron-builder)',
    ),
  );
});
