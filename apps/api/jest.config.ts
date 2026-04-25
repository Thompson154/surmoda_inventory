import type { Config } from 'jest';

const baseProject: Partial<Config> = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
  moduleNameMapper: {
    '^@surmoda/contracts$': '<rootDir>/../../packages/contracts/src/index.ts',
    '^@surmoda/contracts/(.*)$': '<rootDir>/../../packages/contracts/src/$1',
  },
  setupFiles: ['<rootDir>/src/test/setupEnv.ts'],
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
};

const config: Config = {
  rootDir: '.',
  projects: [
    {
      displayName: 'unit',
      ...baseProject,
      testMatch: ['<rootDir>/src/**/__tests__/**/*.spec.ts'],
    },
    {
      displayName: 'integration',
      ...baseProject,
      testMatch: ['<rootDir>/tests/integration/**/*.spec.ts'],
      setupFilesAfterEnv: ['<rootDir>/tests/integration/setup.ts'],
    },
  ],
  collectCoverage: false,
  collectCoverageFrom: [
    'src/modules/**/{service,repository}.ts',
    'src/middleware/**/*.ts',
    'src/jobs/**/*.ts',
    '!src/**/__tests__/**',
    '!src/**/*.spec.ts',
    '!src/**/tests/**',
    '!src/**/*.d.ts',
    '!dist/**',
  ],
  coverageReporters: ['text', 'html', 'lcov'],
  // WHY: Global thresholds set to current actual coverage minus 5% as guardrail.
  // Repositories are covered by integration tests (not unit), so global unit numbers
  // are lower than module-only numbers. Raise these as integration coverage grows.
  coverageThreshold: {
    global: {
      lines: 73,
      statements: 71,
      branches: 65,
      functions: 60,
    },
  },
};

export default config;
