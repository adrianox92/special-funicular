'use strict';

const fs = require('fs');
const path = require('path');

const SPEC_FILENAME = 'slot-database-api.v1.yaml';
const DOCS_MOUNT = '/api/docs';

/**
 * Canonical OpenAPI file lives at repo-root `docs/openapi/slot-database-api.v1.yaml`.
 * Resolve from several cwd layouts (backend/, repo root, Render rootDir=backend).
 * @returns {string}
 */
function resolveOpenApiSpecPath() {
  const candidates = [
    path.resolve(__dirname, '../../docs/openapi', SPEC_FILENAME),
    path.resolve(process.cwd(), 'docs/openapi', SPEC_FILENAME),
    path.resolve(process.cwd(), '../docs/openapi', SPEC_FILENAME),
    path.resolve(__dirname, '../docs/openapi', SPEC_FILENAME),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return candidates[0];
}

function isPartnerDocsPath(requestPath) {
  if (!requestPath) return false;
  return requestPath === DOCS_MOUNT || requestPath.startsWith(`${DOCS_MOUNT}/`);
}

/**
 * Public Swagger HTML. Assets and spec use absolute `/api/docs/...` paths so
 * both `/api/docs` and `/api/docs/` work (no trailing-slash dependency).
 * @returns {string}
 */
function renderPartnerDocsHtml() {
  const specUrl = `${DOCS_MOUNT}/openapi.yaml`;
  const cssUrl = `${DOCS_MOUNT}/swagger-ui.css`;
  const bundleUrl = `${DOCS_MOUNT}/swagger-ui-bundle.js`;
  const fav32 = `${DOCS_MOUNT}/favicon-32x32.png`;
  const fav16 = `${DOCS_MOUNT}/favicon-16x16.png`;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="index,follow" />
  <title>Slot Database API</title>
  <link rel="icon" type="image/png" href="${fav32}" sizes="32x32" />
  <link rel="icon" type="image/png" href="${fav16}" sizes="16x16" />
  <link rel="stylesheet" type="text/css" href="${cssUrl}" />
  <style>
    html { box-sizing: border-box; }
    *, *::before, *::after { box-sizing: inherit; }
    body {
      margin: 0;
      background: #fafafa;
      color: #1f2937;
      font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
    }
    .sdb-docs-intro {
      max-width: 1460px;
      margin: 0 auto;
      padding: 28px 20px 8px;
    }
    .sdb-docs-intro h1 {
      margin: 0 0 8px;
      font-size: 1.75rem;
      font-weight: 700;
      letter-spacing: -0.02em;
    }
    .sdb-docs-intro .sdb-kicker {
      margin: 0 0 16px;
      font-size: 0.8rem;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: #4b5563;
    }
    .sdb-docs-intro p {
      margin: 0 0 12px;
      max-width: 72ch;
      line-height: 1.55;
      font-size: 0.95rem;
    }
    .sdb-docs-intro code {
      font-size: 0.88em;
      background: #e5e7eb;
      padding: 0.1em 0.35em;
      border-radius: 4px;
    }
    .sdb-docs-intro a { color: #111827; }
    .swagger-ui .topbar { display: none; }
  </style>
</head>
<body>
  <header class="sdb-docs-intro">
    <p class="sdb-kicker">Partner Sync v1</p>
    <h1>Slot Database API</h1>
    <p lang="es">
      API pública para que herramientas de cronometraje y gestores de pista
      sincronicen vehículos, circuitos, tiempos, clubes y competiciones con
      Slot Database. Obtén tu clave en <strong>Perfil</strong>
      (crear / copiar / regenerar) e identifícate con el header
      <code>X-API-Key</code>. El contrato es <strong>aditivo</strong>: no se
      eliminan ni se renombran paths ni campos estables sin una versión nueva.
    </p>
    <p lang="en">
      Public API for timing tools and track managers to sync vehicles, circuits,
      timings, clubs, and competitions with Slot Database. Get your key from
      <strong>Profile</strong> (create / copy / regenerate) and authenticate with
      the <code>X-API-Key</code> header. Compatibility is <strong>additive</strong>:
      stable paths and fields are not removed or renamed without a new version.
    </p>
    <p lang="es">
      Usa <em>Authorize</em> y <em>Try it out</em> contra el servidor de
      <strong>producción</strong> listado en el spec. Spec:
      <a href="${specUrl}"><code>docs/openapi/slot-database-api.v1.yaml</code></a>.
    </p>
  </header>
  <div id="swagger-ui"></div>
  <script src="${bundleUrl}"></script>
  <script>
    window.ui = SwaggerUIBundle({
      url: ${JSON.stringify(specUrl)},
      dom_id: '#swagger-ui',
      deepLinking: true,
      persistAuthorization: true,
      displayRequestDuration: true,
      tryItOutEnabled: true,
      presets: [SwaggerUIBundle.presets.apis],
      layout: 'BaseLayout'
    });
  </script>
</body>
</html>
`;
}

module.exports = {
  SPEC_FILENAME,
  DOCS_MOUNT,
  resolveOpenApiSpecPath,
  isPartnerDocsPath,
  renderPartnerDocsHtml,
};
