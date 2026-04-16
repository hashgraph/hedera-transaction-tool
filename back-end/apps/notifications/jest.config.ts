import type { Config } from 'jest';
import baseConfig from '../../jest.config';

const includeLibs = process.env.INCLUDE_LIBS !== '0';

const config: Config = {
  ...baseConfig,
  rootDir: '.',
  collectCoverageFrom: ['<rootDir>/src/**/*.{!(module),}.(t|j)s'],
  // include libs only when INCLUDE_LIBS !== '0'
  roots: includeLibs ? ['<rootDir>/../../libs/', '<rootDir>/src'] : ['<rootDir>/src'],
  moduleNameMapper: {
    '^@app/common(|/.*)$': '<rootDir>/../../libs/common/src/$1',
    '^@entities(|/.*)$': '<rootDir>/../../libs/common/src/database/entities/$1',
  },
  // Diagnostic (issue #2576): surface leaked timers/sockets/ioredis clients
  // that would otherwise be attributed to whichever suite is active at teardown.
  detectOpenHandles: true,
};

export default config;
