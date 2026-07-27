module.exports = {
  displayName: 'ledger',
  preset: '../../jest.preset.js',
  globals: {},
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
      },
    ],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/apps/ledger',

  // Include EP-3 application-level e2e suites (`*.e2e-spec.ts`) alongside units;
  // the default preset only matches `*.spec.ts`/`*.test.ts`.
  testMatch: ['**/*.spec.ts', '**/*.e2e-spec.ts'],

  // `jose` ships ESM only; this CJS runner must transform it.
  transformIgnorePatterns: ['/node_modules/(?!jose/)'],

  // Mirrors the `paths` in tsconfig.
  moduleNameMapper: {
    // Force the compiled CJS entry: ts-jest otherwise resolves `typeorm` to
    // its .ts source, where decorators load as undefined.
    '^typeorm$': '<rootDir>/../../node_modules/typeorm/index.js',
    '^@ledger/(.*)$': '<rootDir>/src/$1',
    '^@cqrs/(.*)$': '<rootDir>/../../libs/cqrs/src/$1',
    // Deep imports (e.g. the telemetry bootstrap side-effect module) must win
    // over the barrel mapping below, so this entry comes first.
    '^@shared/(.*)$': '<rootDir>/../../libs/shared/src/$1',
    '^@shared$': '<rootDir>/../../libs/shared/src/index.ts',
  },
};
