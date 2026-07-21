const path = require('path');

// `npm start` / `npm test` → sin plugin ESLint en webpack (más rápido).
// `npm run build` → ESLint activo.
const enableEslintInWebpack = process.env.npm_lifecycle_event === 'build';

module.exports = {
  eslint: {
    enable: enableEslintInWebpack,
  },
  webpack: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
    configure: (webpackConfig, { env }) => {
      if (env === 'development') {
        // Cache en disco: el 2º `npm start` (y rebuilds) arrancan mucho más rápido.
        webpackConfig.cache = {
          type: 'filesystem',
          buildDependencies: {
            config: [__filename],
          },
        };
        // Source maps más baratos en dev (sigue permitiendo depurar en el navegador).
        webpackConfig.devtool = 'eval-cheap-module-source-map';
      }
      return webpackConfig;
    },
  },
  jest: {
    configure: {
      moduleNameMapper: {
        '^react-router-dom$': '<rootDir>/src/test-utils/reactRouterDomMock.js',
        '^react-router-dom/(.*)$': '<rootDir>/src/test-utils/reactRouterDomMock.js',
      },
    },
  },
};
