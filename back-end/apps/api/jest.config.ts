import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '../../',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: ['<rootDir>/apps/api/src/**/*.{!(module),}.(t|j)s'],
  testEnvironment: 'node',
  roots: ['<rootDir>/libs/', '<rootDir>/apps/api'],
  moduleNameMapper: {
    '^@app/common(|/.*)$': '<rootDir>/libs/common/src/$1',
    '^@entities(|/.*)$': '<rootDir>/libs/common/src/database/entities/$1',
  },
};

if (process.env.CI) {
  config.maxWorkers = 2; // This is to prevent Jest from starving the worker in CI environments and causing instability
}

export default config;
