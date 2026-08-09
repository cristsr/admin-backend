module.exports = {
  displayName: 'cqrs',
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
  coverageDirectory: '../../coverage/libs/cqrs',

  // Importing the `@shared` barrel pulls its auth module, and from there
  // jwks-rsa -> jose, which ships ESM only while this runner is CJS.
  // canonicalize is ESM-only too (used by the chain-hashing utilities).
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
    '^@cqrs/(.*)$': '<rootDir>/src/$1',
    '^@shared/(.*)$': '<rootDir>/../../libs/shared/src/$1',
    '^@shared$': '<rootDir>/../../libs/shared/src/index.ts',
  },
};
