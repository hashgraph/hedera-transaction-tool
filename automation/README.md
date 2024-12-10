# Hedera Transaction Tool Tests

This project contains automated tests for the Hedera Transaction Tool, designed to ensure the reliability and
functionality of the application. The tests are written using [Playwright](https://playwright.dev/), a powerful
framework for testing web applications across different browsers.

## Prerequisites

Before you begin, ensure you have the following installed on your system:

- Node.js: `20.17.0`

Additionally, you should have the Hedera Transaction Tool executable installed and know its path, as it will be required
to run the tests.

## Setup

1. **Clone the repository** to your local machine using Git:

   ```bash
   git clone <repository-url>
   ```

2. **Navigate to the project directory**:

   ```bash
   cd hedera-transaction-tool\automation
   ```

3. **Install dependencies** by running:

   ```bash
   pnpm install
   ```

4. **Configure the environment variables** by creating a `.env` file in the root of the project and setting the path to
   the Hedera Transaction Tool executable. For example:

   ```env
   EXECUTABLE_PATH='/path/to/Hedera Transaction Tool'
   PRIVATE_KEY='your_private_key_here'
   ENVIRONMENT='LOCALNET'
   ORGANIZATION_URL: URL for your organization, e.g., https://localhost:3001.

   POSTGRES_HOST: Host of your PostgreSQL server
   POSTGRES_PORT: Port for your PostgreSQL server
   POSTGRES_DATABASE: Name of your PostgreSQL database
   POSTGRES_USERNAME: Username for your PostgreSQL database
   POSTGRES_PASSWORD: Password for your PostgreSQL database
   ```

   Replace `ENVIRONMENT` with variable that can be set to `TESTNET` or `LOCALNET`.

   Depending on the environment selected:

   - TESTNET: Use your ECDSA private keys.
   - LOCALNET: Use your ED25519 private keys.

## Running Tests

To run all tests, execute the following command from the root of the project:

```bash
npx playwright test
```

This will launch Playwright and execute the test suites defined in the project, outputting the results to your terminal.

## Current Тest Suites

### 1. Registration tests

```bash
npx playwright test tests/RegistrationTests
```

### 2. Login tests

```bash
npx playwright test tests/LoginTests
```

### 3. Settings tests

```bash
npx playwright test tests/SettingsTests
```

### 4. Transactions tests

```bash
npx playwright test tests/TransactionTests
```

### 5. Workflow tests

```bash
npx playwright test tests/WorkflowTests
```

### 6. Organization Settings tests

```bash
npx playwright test tests/OrganizationSettingsTests
```

### 7. Organization Transaction tests

```bash
npx playwright test tests/OrganizationTransactionTests
```

### 8. Organization Contact list tests

```bash
npx playwright test tests/OrganizationContactListTests
```

### 9. Organization Regression tests

```bash
npx playwright test tests/organizationRegressionTests
```

### 10. Organization Notification tests

```bash
npx playwright test tests/OrganizationNotificationTests
```

### 11. System files tests

```bash
npx playwright test tests/SystemFileTests
```

### 12. Group transaction tests

```bash
npx playwright test tests/GroupTransactionTests
```
