const { exec } = require('child_process');
const fs = require('fs/promises');
const path = require('path');

const NOTICE_FILE_NAME = 'NOTICE';
const licenseCheckerPackage = 'license-checker@25.0.1';

const paths = {
  noticeFile: path.resolve(__dirname, '..', NOTICE_FILE_NAME),
  automation: path.resolve(__dirname, '..', 'automation'),
  frontEnd: path.resolve(__dirname, '..', 'front-end'),
  backEndRoot: path.resolve(__dirname, '..', 'back-end'),
  backEndApi: path.resolve(__dirname, '..', 'back-end', 'apps', 'api'),
  backEndChain: path.resolve(__dirname, '..', 'back-end', 'apps', 'chain'),
  backEndNotifications: path.resolve(
    __dirname,
    '..',
    'back-end',
    'apps',
    'notifications'
  ),
};

console.time('NOTICE generation time');
(async function writeNoticeFile() {
  try {
    const content = await getContent();
    await fs.writeFile(paths.noticeFile, content);
    console.log('NOTICE file written successfully.');
  } catch (error) {
    console.error(`Failed to write NOTICE file: ${error.message}`);
  }
  console.timeEnd('NOTICE generation time');
})();

async function getContent() {
  let content = getHeader();
  const allDeps = await getAllDependencies();

  content += getLicenseCheckerNoticeText();
  for (const [name, license] of Object.entries(allDeps)) {
    content += getLicenseNoticeText(name, license);
  }

  return content;
}

function getHeader() {
  return `Apache License
Version 2.0, January 2004 
http://www.apache.org/licenses/

NOTICE file for the Hedera Transaction Tool project.

This product includes the following third-party dependencies:\n`;
}

function getLicenseCheckerNoticeText() {
  return getLicenseNoticeText(licenseCheckerPackage, {
    publisher: 'Dav Glass <davglass@gmail.com>',
    repository: 'https://github.com/davglass/license-checker',
  });
}

function getLicenseNoticeText(name, license) {
  const sanitizedName = sanitize(name);
  const sanitizedSource = sanitize(license.repository || license.url || '');
  const sanitizedPublisher = sanitize(license.publisher || '');

  if (!sanitizedPublisher) {
    return `
This product includes software (${sanitizedName}) developed at
(${sanitizedSource}).
`;
  }

  return `
The Initial Developer of ${sanitizedName},
is ${sanitizedPublisher} (${sanitizedSource}).
Copyright ${sanitizedPublisher}. All Rights Reserved.
`;
}

async function getAllDependencies() {
  const dirs = [
    paths.automation,
    paths.frontEnd,
    paths.backEndRoot,
    paths.backEndApi,
    paths.backEndChain,
    paths.backEndNotifications,
  ];
  const allDeps = {};

  const deps = await Promise.all(dirs.map((dir) => getDependencies(dir)));
  deps.forEach((dep) => Object.assign(allDeps, dep));

  return allDeps;
}

async function getDependencies(cwd) {
  try {
    const projectNames = await getProjectNames();
    const { stdout } = await execPromise(
      `npx ${licenseCheckerPackage} --json --excludePackages '${projectNames.join(
        ';'
      )}'`,
      { cwd }
    );
    return JSON.parse(stdout);
  } catch (error) {
    throw new Error(`Failed to get dependencies: ${error.message}`);
  }
}

async function getProjectNames() {
  const dirs = [
    paths.automation,
    paths.frontEnd,
    paths.backEndRoot,
    paths.backEndApi,
    paths.backEndChain,
    paths.backEndNotifications,
  ];
  const projectNames = [];

  for (const dir of dirs) {
    try {
      const packageJsonPath = path.join(dir, 'package.json');
      const packageJson = JSON.parse(
        await fs.readFile(packageJsonPath, {
          encoding: 'utf-8',
          flag: 'r',
        })
      );
      projectNames.push(`${packageJson.name}@${packageJson.version}`);
    } catch (error) {
      console.error(`Failed to read package.json in ${dir}: ${error.message}`);
    }
  }

  return projectNames;
}

function execPromise(command, options) {
  return new Promise((resolve, reject) => {
    exec(command, options, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

function sanitize(input) {
  return input.replace(/[&<>"'`]/g, (char) => {
    const charMap = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
      '`': '&#96;',
    };
    return charMap[char] || char;
  });
}
