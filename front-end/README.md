[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

# Hedera Transaction Tool

The Hedera Transaction Tool application is a demo application that allows a user to generate keys, create, sign, and submit transactions to a Hedera network. This software is designed for use solely by the Hedera Council and staff. The software is being released as open source as example code only, and is not intended or suitable for use in its current form by anyone other than members of the Hedera Council and Hedera personnel. If you are not a Hedera Council member or staff member, use of this application or of the code in its current form is not recommended
and is at your own risk.

# Prerequisites

- [Node](https://nodejs.org/en/download/package-manager) version: >=`22.12.0`
- Version check: `node-v`
- [pnpm](https://pnpm.io/installation) version: >=`9.13.1`
- Version check: `pnpm --version`
- [python-setuptools](https://pypi.org/project/setuptools) version: >=`75.6.0`

Installation of `pnpm`:

```bash
npm install -g pnpm@latest
```

Installation of `python-setuptools` with `brew`:

```bash
brew install python-setuptools
```

## 1. Clone the project

```bash
git clone https://github.com/hashgraph/hedera-transaction-tool.git
cd front-end
```

## 2. Install dependencies

```bash
pnpm install
```

## 3. Generate Prisma client library

```bash
pnpm generate:database
```

## 4. Start developing

```bash
pnpm dev
```

## 5. Build for distribution

```bash
pnpm run build:mac # uses mac as build target
```

## 6. Run the unit tests

```bash
pnpm test:main # run tests for the main process
```

Run the tests with coverage

```bash
pnpm test:main:coverage # run tests for the main process
```

## 7. Troubleshooting

- If a problem with the @prisma/client occur, try running `npx prisma generate` or reinstall the `node_modules` and then run `npx prisma generate`
