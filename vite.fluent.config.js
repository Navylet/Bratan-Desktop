const path = require('path');
const reactPlugin = require('@vitejs/plugin-react');
const { defineConfig } = require('vite');

const react = reactPlugin.default || reactPlugin;

function manualChunks(id) {
  if (!id.includes('node_modules')) {
    return;
  }

  if (id.includes('@fluentui/')) {
    return 'vendor-fluent-core';
  }

  if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) {
    return 'vendor-react';
  }
}

module.exports = defineConfig({
  root: path.resolve(__dirname, 'src/fluent-app'),
  plugins: [react()],
  base: './',
  server: {
    host: '127.0.0.1',
    port: 5174,
    strictPort: true,
  },
  build: {
    outDir: path.resolve(__dirname, 'dist-fluent'),
    emptyOutDir: false,
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks,
      },
    },
  },
});
