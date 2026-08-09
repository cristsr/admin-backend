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

  // `jose` and `canonicalize` ship ESM only; this CJS runner must transform them.
  transformIgnorePatterns: ['/node_modules/(?!(jose|canonicalize)/)'],

  // Mirrors the `paths` in tsconfig.
  moduleNameMapper: {
    // Force the compiled CJS entry: ts-jest otherwise resolves `typeorm` to
    // its .ts source, where decorators load as undefined.
    '^typeorm$': '<rootDir>/../../node_modules/typeorm/index.js',
    // canonicalize's package.json "exports" map declares only an "import"
    // condition (no "require"/"default"), which Jest's CJS-mode resolver
    // cannot match — point it straight at the real file instead.
    '^canonicalize$': '<rootDir>/../../node_modules/canonicalize/lib/canonicalize.js',
    '^@ledger/(.*)$': '<rootDir>/src/$1',
    '^@cqrs/(.*)$': '<rootDir>/../../libs/cqrs/src/$1',
    // Deep imports (e.g. the telemetry bootstrap side-effect module) must win
    // over the barrel mapping below, so this entry comes first.
    '^@shared/(.*)$': '<rootDir>/../../libs/shared/src/$1',
    '^@shared$': '<rootDir>/../../libs/shared/src/index.ts',
  },
};
