const crypto = require('crypto');

/** Sin 0/O/1/l para que el código se pueda leer si alguien lo copia a mano. */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

function createShortCode(randomBytes = (n) => crypto.randomBytes(n)) {
  const bytes = randomBytes(7);
  let code = '';
  for (let i = 0; i < 7; i += 1) {
    code += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return code;
}

module.exports = {
  ALPHABET,
  createShortCode,
};
