import { defineConfig } from '@vscode/test-cli';

export default defineConfig({
	files: 'out/src/test/**/*.test.js',
  mocha: {
      label: 'unitTests',
      ui: 'tdd',
      timeout: 20000
    }
});
