import type { Config } from 'jest';
import baseConfig from '../../jest.config';

const includeLibs = process.env.INCLUDE_LIBS !== '0';
// Diagnostics (issue #2576) are CI-only by default: GitHub Actions sets CI=true
// automatically. Local dev gets the fast path; opt back in with JEST_DIAG=1.
const enableDiag = Boolean(process.env.CI || process.env.JEST_DIAG);

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
  detectOpenHandles: enableDiag,
  setupFiles: enableDiag ? ['<rootDir>/../../test-utils/jest.setup.diag.ts'] : [],
};

export default config;
