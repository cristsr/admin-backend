import js from '@eslint/js';
import nx from '@nx/eslint-plugin';
import importX from 'eslint-plugin-import-x';
import jsdoc from 'eslint-plugin-jsdoc';

export default [
  js.configs.recommended,
  ...nx.configs['flat/base'],
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          // The app reaches its own files through @app/*; Nx would otherwise
          // demand relative paths for anything inside the same project.
          allow: ['@app/**'],
          depConstraints: [
            {
              sourceTag: '*',
              onlyDependOnLibsWithTags: ['*'],
            },
          ],
        },
      ],
      'no-console': 'error',
      'no-useless-constructor': 'off',
    },
  },
  ...nx.configs['flat/typescript'],
  {
    files: ['**/*.ts', '**/*.tsx'],
    plugins: {
      // `import-x` rather than `import`: the original plugin stopped at ESLint
      // 9, and this fork is the maintained continuation of it.
      'import-x': importX,
      jsdoc,
    },
    rules: {
      ...jsdoc.configs['flat/recommended-typescript'].rules,
      'jsdoc/require-jsdoc': 'off',
      'jsdoc/require-param': 'off',
      'jsdoc/require-returns': 'off',
      'jsdoc/require-description': 'off',
      'jsdoc/tag-lines': 'off',
      'jsdoc/check-alignment': 'warn',
      'jsdoc/check-param-names': 'warn',
      'jsdoc/check-tag-names': 'warn',
      'jsdoc/no-blank-blocks': 'warn',
      'jsdoc/empty-tags': 'warn',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      'sort-imports': [
        'error',
        {
          ignoreCase: false,
          ignoreDeclarationSort: true,
          ignoreMemberSort: false,
          memberSyntaxSortOrder: ['none', 'all', 'multiple', 'single'],
          allowSeparatedGroups: true,
        },
      ],
      'import-x/order': [
        'error',
        {
          groups: [
            'builtin',
            'external',
            'internal',
            'parent',
            'sibling',
            'index',
            'unknown',
          ],
          pathGroups: [
            {
              pattern: '@nestjs/**',
              group: 'builtin',
              position: 'before',
            },
            {
              pattern: '@admin-back/**',
              group: 'internal',
              position: 'before',
            },
            {
              pattern: '@app/**',
              group: 'internal',
              position: 'before',
            },
          ],
          pathGroupsExcludedImportTypes: [
            '@nestjs/**',
            '@admin-back/**',
            '@app/**',
          ],
          'newlines-between': 'never',
          alphabetize: {
            order: 'asc',
            caseInsensitive: true,
          },
        },
      ],
    },
  },
  ...nx.configs['flat/javascript'],
];
