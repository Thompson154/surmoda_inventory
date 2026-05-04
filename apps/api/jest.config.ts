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
  // WHY: constitución § 3.3 — floor gates to prevent coverage regression.
  coverageThreshold: {
    global: {
      statements: 80,
      branches: 70,
      functions: 80,
      lines: 80,
    },
    // WHY: constitución § 3.3 exige ≥80% en services y repositories específicamente
    './src/modules/**/service.ts': {
      statements: 80,
      branches: 75,
      functions: 80,
      lines: 80,
    },
    './src/modules/**/repository.ts': {
      statements: 80,
      branches: 70,
      functions: 80,
      lines: 80,
    },
  },
};

export default config;
