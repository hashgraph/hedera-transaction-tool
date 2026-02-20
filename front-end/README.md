[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

# Hedera Transaction Tool

The Hedera Transaction Tool application is a demo application that allows a user to generate keys, create, sign, and submit transactions to a Hedera network. This software is designed for use solely by the Hedera Council and staff. The software is being released as open source as example code only, and is not intended or suitable for use in its current form by anyone other than members of the Hedera Council and Hedera personnel. If you are not a Hedera Council member or staff member, use of this application or of the code in its current form is not recommended
and is at your own risk.

# Prerequisites

- [**Node.js**](https://nodejs.org/en/download/package-manager)
  - Required version: `>= 22.12.0`
  - Verify installation:

    ```bash
    node -v
    ```

- [**pnpm**](https://pnpm.io/installation)
  - Required version: `>= 9.13.1`
  - Installation of `pnpm`(if not already installed):

    ```bash
    npm install -g pnpm@latest
    ```
  - Verify installation:

    ```bash
    pnpm --version
    ```

- [**Python setuptools**](https://pypi.org/project/setuptools)
  - Required version: `>= 75.6.0`
  - Installation of `python-setuptools` with `brew`:

    ```bash
    brew install python-setuptools
    ```
  - Verify installation:

    ```bash
    python -m setuptools --version
    ```

## 1. Clone the project

```bash
git clone https://github.com/hashgraph/hedera-transaction-tool.git
cd hedera-transaction-tool/front-end
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
pnpm build:mac # uses mac as build target
```

## 6. Run the unit tests

```bash
pnpm test:main # run tests for the main process
pnpm test:renderer # run tests for the renderer process
pnpm test:shared # run tests for the shared utils
```

Run the tests with coverage

```bash
pnpm test:main:coverage # run tests for the main process
pnpm test:renderer:coverage # run tests for the renderer process
pnpm test:shared:coverage # run tests for the shared utils
```

## 7. Troubleshooting

- **Prisma issues**
  - If you encounter problems with `@prisma/client`:

    ```bash
    npx prisma generate
    ```
  - Alternatively, reinstall `node_modules` and run:

    ```bash
    npx prisma generate
    ```

- **ENOENT errors**
  - If errors persist after reinstalling `node_modules` and running `prisma_generate`, it may be caused by a missing Electron distribution.
  - To fix this, manually rebuild Electron from the `front-end` directory:

    ```bash
    pnpm rebuild electron
    ```

