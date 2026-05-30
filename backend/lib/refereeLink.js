const crypto = require('crypto');

function getFrontendBase() {
  return (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/+$/, '');
}

function generateRefereeAccessToken() {
  return crypto.randomBytes(32).toString('hex');
}

function buildRefereeUrl(token) {
  return `${getFrontendBase()}/referee/${encodeURIComponent(token)}`;
}

module.exports = {
  getFrontendBase,
  generateRefereeAccessToken,
  buildRefereeUrl,
};
