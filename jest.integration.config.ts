import type { Config } from 'jest';

const config: Config = {
  displayName: 'integration',
  rootDir: '.',
  testMatch: ['<rootDir>/itest/**/*itest.ts'],
  preset: 'ts-jest',
  testEnvironment: 'node',
  verbose: true,
  // keep transforms minimal; project already uses TS
  transform: { '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.json' }] },
};

export default config;
