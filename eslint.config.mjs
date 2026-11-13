import js from '@eslint/js'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', '**/generated/**', 'odd/**', 'apps/web/playwright-report/**'] },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat.recommended, jsxA11y.flatConfigs.recommended],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['apps/api/**/*.{ts,mjs}', 'scripts/**/*.mjs', '*.mjs'],
    languageOptions: { globals: globals.node },
  },
)
