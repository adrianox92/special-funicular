/**
 * Genera un código promocional pre-asignado a un email.
 *
 * Uso:
 *   node backend/scripts/generate-promo-code.js --email usuario@email.com
 *   node backend/scripts/generate-promo-code.js --email usuario@email.com --note "Amigo del equipo"
 */
const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const { getServiceClient } = require('../lib/supabaseClients');
const { generatePromoCode } = require('../lib/promoCodeGenerator');

function parseArgs(argv) {
  const args = { email: null, note: null };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--email' && argv[i + 1]) {
      args.email = argv[i + 1];
      i += 1;
    } else if (arg === '--note' && argv[i + 1]) {
      args.note = argv[i + 1];
      i += 1;
    }
  }

  return args;
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function insertUniqueCode(supabase, { assignedEmail, note }) {
  const maxAttempts = 5;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const code = generatePromoCode();
    const { data, error } = await supabase
      .from('promo_codes')
      .insert({
        code,
        assigned_email: assignedEmail,
        note: note ?? null,
      })
      .select('code, assigned_email, note, created_at')
      .single();

    if (!error) return data;

    if (error.code === '23505' && error.message?.includes('promo_codes_code_key')) {
      continue;
    }

    throw error;
  }

  throw new Error('No se pudo generar un código único');
}

async function main() {
  const { email, note } = parseArgs(process.argv);

  if (!email) {
    console.error('Uso: node backend/scripts/generate-promo-code.js --email usuario@email.com [--note "Nota"]');
    process.exit(1);
  }

  const assignedEmail = email.trim().toLowerCase();
  if (!isValidEmail(assignedEmail)) {
    console.error('[ERR] Email inválido:', email);
    process.exit(1);
  }

  const supabase = getServiceClient();
  if (!supabase) {
    console.error('[ERR] SUPABASE_SERVICE_ROLE_KEY no configurada en .env');
    process.exit(1);
  }

  try {
    const row = await insertUniqueCode(supabase, {
      assignedEmail,
      note: note?.trim() || null,
    });

    console.log('[OK] Código promocional generado');
    console.log(`     Código:  ${row.code}`);
    console.log(`     Email:   ${row.assigned_email}`);
    if (row.note) console.log(`     Nota:    ${row.note}`);
    console.log(`     Creado:  ${row.created_at}`);
  } catch (err) {
    console.error('[ERR] Error al generar el código:', err?.message || err);
    process.exit(1);
  }
}

main();
