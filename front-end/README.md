[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

# Hedera Transaction Tool

The Hedera Transaction Tool application is a demo application that allows a user to generate keys, create, sign, and submit transactions to a Hedera network. This software is designed for use solely by the Hedera Council and staff. The software is being released as open source as example code only, and is not intended or suitable for use in its current form by anyone other than members of the Hedera Council and Hedera personnel. If you are not a Hedera Council member or staff member, use of this application or of the code in its current form is not recommended
and is at your own risk.

## Prerequisites

Node version: `20.9.0`

If you use another version, please use [n](https://github.com/tj/n) to manage.

### Install dependencies ⏬

```bash
npm install
```

### Prebuild binaries

Replace the `--arch` argument with your architecture

```bash
npm run postinstall -- --arch arm64
```

### Run the following command to start Vue devtools

```bash
npm run devTools
```

### Start developing ⚒️

Generate prisma client:

```bash
npx prisma generate
```

Run in development mode:

```bash
npm run dev
```

### Additional Commands

Build the app localy

```bash
npm run build # builds application, distributable files can be found in "dist" folder

# OR

npm run build:mac # uses mac as build target
```

Run the tests

```bash
npm run test:main # run tests for the main folder
```

Run the tests with coverage

```bash
npm run test:main:coverage # run tests for the main folder
```

## Publish

1. Create Draft release with the proper tag (version in `package.json` needs to match) and prefix `v`
2. Genereate Classic access token (check the `repo` option)
3. Generate self sign certificate (TBD)
4. Run in terminal `GH_TOKEN=<ACCESS_TOKEN> npm run publish`
5. Go to Releases and click `Publish release`
