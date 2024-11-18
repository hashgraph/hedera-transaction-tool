const { exec } = require('child_process');
const fs = require('fs/promises');
const path = require('path');

const NOTICE_FILE_NAME = 'NOTICE';

const filePath = path.resolve(__dirname, '..', NOTICE_FILE_NAME);
const frontEndDir = path.resolve(__dirname, '..', 'front-end');
const backEndRootDir = path.resolve(__dirname, '..', 'back-end');
const backEndApiDir = path.resolve(__dirname, '..', 'back-end', 'apps', 'api');
const backEndChainDir = path.resolve(
  __dirname,
  '..',
  'back-end',
  'apps',
  'chain'
);
const backEndNotificationsDir = path.resolve(
  __dirname,
  '..',
  'back-end',
  'apps',
  'notifications'
);

const licenseCheckerPackage = 'license-checker@25.0.1';

writeNoticeFile();

async function writeNoticeFile() {
  fs.writeFile(filePath, await getContent());
}

async function getContent() {
  let content = '';
  console.log('Getting header...');
  content += getHeader();

  console.log('Getting dependencies...');

  console.log('Getting front-end dependencies...');
  const frontEndDeps = await getDependencies(frontEndDir);

  console.log('Getting back-end dependencies...');
  const backEndRootDeps = await getDependencies(backEndRootDir);

  console.log('Getting back-end API microservice dependencies...');
  const backEndApiDeps = await getDependencies(backEndApiDir);

  console.log('Getting back-end Chain microservice dependencies...');
  const backEndChainDeps = await getDependencies(backEndChainDir);

  console.log('Getting back-end Notifications microservice dependencies...');
  const backEndNotificationsDeps = await getDependencies(
    backEndNotificationsDir
  );

  const allDeps = {
    ...frontEndDeps,
    ...backEndRootDeps,
    ...backEndApiDeps,
    ...backEndChainDeps,
    ...backEndNotificationsDeps,
  };

  console.log('Generating content for license-checker...');
  content += getLicenseCheckerNoticeText();

  console.log('Generating dependencies content...');
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
  const sanitizedSource = sanitize(
    license.repository || license.url || license.url
  );

  if (!license.publisher) {
    return `
This product includes software (${name}) developed at
(${sanitizedSource}).
`;
  }

  const sanitizedPublisher = sanitize(license.publisher);
  return `
The Initial Developer of ${sanitizedName},
is ${sanitizedPublisher} (${sanitizedSource}).
Copyright ${sanitizedPublisher}. All Rights Reserved.
`;
}

async function getDependencies(cwd) {
  try {
    const names = await getProjectNames();
    const { stdout } = await execPromise(
      `npx ${licenseCheckerPackage} --json --excludePackages '${names.join(
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
  const projectDirs = [
    frontEndDir,
    backEndRootDir,
    backEndApiDir,
    backEndChainDir,
    backEndNotificationsDir,
  ];

  const projectNames = [];

  for (const dir of projectDirs) {
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
