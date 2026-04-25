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
    'src/middleware/*.ts',
    '!src/**/__tests__/**',
    '!src/**/*.d.ts',
  ],
  coverageReporters: ['text', 'html', 'lcov'],
  coverageThreshold: {
    global: {
      lines: 0,
      branches: 0,
      functions: 0,
      statements: 0,
    },
    'src/modules/**/{service,repository}.ts': {
      lines: 80,
      branches: 80,
      functions: 80,
      statements: 80,
    },
  },
};

export default config;
