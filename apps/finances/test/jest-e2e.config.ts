export default {
  displayName: 'finances-e2e',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  rootDir: '..',
  testMatch: ['**/*.e2e-spec.ts'],
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  // Mirrors the unit config and the tsconfig `paths`: @app/* and @shared.
  moduleNameMapper: {
    '^typeorm$': '<rootDir>/../../node_modules/typeorm/index.js',
    '^@app/(.*)$': '<rootDir>/src/$1',
    '@shared': '<rootDir>/../../libs/shared/src/index.ts',
  },
};
