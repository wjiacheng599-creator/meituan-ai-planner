import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import reactHooks from 'eslint-plugin-react-hooks';
import prettier from 'eslint-config-prettier';

export default [
  {
    linterOptions: {
      reportUnusedDisableDirectives: false,
    },
  },

  // 忽略文件
  { 
    ignores: [
      '**/dist/**', 
      '**/node_modules/**', 
      '**/worker/**',
      '**/scripts/**',
      '*.config.js',
      '*.config.ts',
      '*.config.mjs',
      '**/coverage/**',
      '**/playwright-report/**',
    ] 
  },
  
  // 基础配置
  js.configs.recommended,
  ...tsPlugin.configs['flat/recommended'],
  prettier,
  
  // React 配置
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
      globals: {
        AbortController: 'readonly',
        AbortSignal: 'readonly',
        AMap: 'readonly',
        Audio: 'readonly',
        Blob: 'readonly',
        clearInterval: 'readonly',
        clearTimeout: 'readonly',
        console: 'readonly',
        document: 'readonly',
        EventSource: 'readonly',
        fetch: 'readonly',
        File: 'readonly',
        FormData: 'readonly',
        global: 'readonly',
        Headers: 'readonly',
        HTMLAudioElement: 'readonly',
        HTMLDivElement: 'readonly',
        HTMLImageElement: 'readonly',
        HTMLInputElement: 'readonly',
        HTMLTextAreaElement: 'readonly',
        importScripts: 'readonly',
        IntersectionObserver: 'readonly',
        localStorage: 'readonly',
        Map: 'readonly',
        navigator: 'readonly',
        NodeJS: 'readonly',
        process: 'readonly',
        Promise: 'readonly',
        React: 'readonly',
        ReadableStream: 'readonly',
        ResizeObserver: 'readonly',
        Response: 'readonly',
        Request: 'readonly',
        sessionStorage: 'readonly',
        setInterval: 'readonly',
        setTimeout: 'readonly',
        TextDecoder: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        window: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      'react-hooks': reactHooks,
    },
    rules: {
      // React 规则
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'off',
      
      // TypeScript 规则：当前项目仍处在竞赛原型阶段，先保留可执行门禁。
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/consistent-type-imports': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-unused-expressions': 'off',
      
      // 代码质量规则
      'no-console': 'off',
      'no-debugger': 'error',
      'no-duplicate-imports': 'off',
      'no-unused-expressions': 'off',
      'no-unused-vars': 'off',
      'prefer-const': 'off',
      'prefer-template': 'off',
      'eqeqeq': 'off',
      'curly': 'off',
      'no-var': 'off',
      'no-implicit-coercion': 'off',
      'no-return-await': 'off',
      'no-throw-literal': 'off',
      'no-useless-concat': 'off',
      'no-useless-return': 'off',
      'no-useless-escape': 'off',
      'no-useless-assignment': 'off',
      'no-empty': 'off',
      'no-case-declarations': 'off',
      'no-dupe-else-if': 'off',
      'no-extra-boolean-cast': 'off',
      'preserve-caught-error': 'off',
      'prefer-destructuring': 'off',
      'prefer-rest-params': 'off',
      'prefer-spread': 'off',
      
      // 可维护性规则
      'max-lines': 'off',
      'max-lines-per-function': 'off',
      'max-depth': 'off',
      'complexity': 'off',
    },
    settings: {
      react: { version: 'detect' },
    },
  },
  
  // 测试文件特殊配置
  {
    files: ['**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}', '**/test/**'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console': 'off',
    },
  }
];
