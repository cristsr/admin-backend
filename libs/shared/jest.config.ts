module.exports = {
  displayName: 'shared',
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
  coverageDirectory: '../../coverage/libs/shared',

  // jose and canonicalize ship ESM only and this runner is CJS, so both must
  // be transformed instead of required as-is.
  transformIgnorePatterns: ['/node_modules/(?!(jose|canonicalize)/)'],

  moduleNameMapper: {
    // canonicalize's package.json "exports" map declares only an "import"
    // condition (no "require"/"default"), which Jest's CJS-mode resolver
    // cannot match — point it straight at the real file instead.
    '^canonicalize$': '<rootDir>/../../node_modules/canonicalize/lib/canonicalize.js',
  },
};
