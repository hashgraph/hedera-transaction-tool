# Hedera Transaction Tool Tests

This project contains automated tests for the Hedera Transaction Tool, designed to ensure the reliability and
functionality of the application. The tests are written using [Playwright](https://playwright.dev/), a powerful
framework for testing web applications across different browsers.

## Prerequisites

Before you begin, ensure you have the following installed on your system:

- Node.js: `20.9.0`

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
   npm install
   ```

4. **Configure the environment variables** by creating a `.env` file in the root of the project and setting the path to
   the Hedera Transaction Tool executable. For example:
   ```env
   EXECUTABLE_PATH='/path/to/Hedera Transaction Tool'
   PRIVATE_KEY='your_private_key_here'
   ```
   Replace `/path/to/Hedera Transaction Tool` with the actual path to your Hedera Transaction Tool executable.
   Replace `your_private_key_here` with the private key(ECDSA) required for tests that involve key import functionality.

## Running Tests

To run all tests, execute the following command from the root of the project:

```bash
npx playwright test --workers=1
```

This will launch Playwright and execute the test suites defined in the project, outputting the results to your terminal.

## Running a Specific Test Suite

If you wish to run a specific suite of test cases, such as the RegistrationTests, you can use the following command:

```bash
npx playwright test tests/RegistrationTests --workers=1
```

Replace `tests/RegistrationTests` with the path to the test suite you want to run. This command allows you to focus on a
specific area of the application, making it useful for targeted testing.
