'use strict';

const fs = require('fs');
const path = require('path');
const express = require('express');
const swaggerUiDist = require('swagger-ui-dist');
const {
  resolveOpenApiSpecPath,
  renderPartnerDocsHtml,
} = require('../lib/partnerOpenApi');

const router = express.Router();
const swaggerDistPath = swaggerUiDist.getAbsoluteFSPath();
const docsHtml = renderPartnerDocsHtml();

function sendOpenApiYaml(_req, res) {
  const specPath = resolveOpenApiSpecPath();
  if (!fs.existsSync(specPath)) {
    console.error('[partner-docs] OpenAPI spec not found at', specPath);
    return res.status(503).json({ error: 'OpenAPI spec not available' });
  }
  res.setHeader('Cache-Control', 'public, max-age=60');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.type('application/yaml');
  return res.sendFile(path.resolve(specPath));
}

router.get('/openapi.yaml', sendOpenApiYaml);
router.get('/slot-database-api.v1.yaml', sendOpenApiYaml);

router.get(['/', '/index.html'], (_req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=60');
  res.type('html');
  res.send(docsHtml);
});

router.use(express.static(swaggerDistPath, { index: false, maxAge: '1d' }));

module.exports = router;
