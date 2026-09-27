import js from '@eslint/js';
import tseslint from 'typescript-eslint';
export default tseslint.config(
 {ignores:['apps/web/dist/**','node_modules/**','playwright-report/**','test-results/**']},
 js.configs.recommended,
 ...tseslint.configs.recommended,
 {files:['**/*.ts','**/*.tsx'],rules:{'@typescript-eslint/no-explicit-any':'off','@typescript-eslint/no-unused-vars':['error',{argsIgnorePattern:'^_'}]}},
 {files:['scripts/**/*.mjs'],languageOptions:{globals:{Buffer:'readonly',console:'readonly',fetch:'readonly',process:'readonly',setTimeout:'readonly'}}},
 {files:['apps/web/src/**/*.{ts,tsx}'],languageOptions:{globals:{AudioContext:'readonly',document:'readonly',window:'readonly',sessionStorage:'readonly',indexedDB:'readonly',Worker:'readonly',HTMLElement:'readonly',HTMLDivElement:'readonly',HTMLCanvasElement:'readonly',MouseEvent:'readonly',KeyboardEvent:'readonly',CustomEvent:'readonly',requestAnimationFrame:'readonly',cancelAnimationFrame:'readonly',performance:'readonly',devicePixelRatio:'readonly',setInterval:'readonly',clearInterval:'readonly',setTimeout:'readonly'}}}
);
