import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '../../',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: ['<rootDir>/apps/chain/**/*.(t|j)s'],
  coverageDirectory: './coverage',
  testEnvironment: 'node',
  roots: ['<rootDir>/libs/', '<rootDir>/apps/chain'],
  moduleNameMapper: {
    '^@app/common(|/.*)$': '<rootDir>/libs/common/src/$1',
    '^@entities(|/.*)$': '<rootDir>/libs/common/src/database/entities/$1',
  },
};

export default config;
