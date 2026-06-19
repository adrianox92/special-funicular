/**
 * Paginación PostgREST con .range() (inclusivo). PostgREST puede devolver 416/PGRST103
 * o, en páginas fuera de rango, data vacía con count null; aquí se normaliza el total.
 */

function isRangeNotSatisfiable(error) {
  if (!error) return false;
  if (error.code === 'PGRST103') return true;
  return /requested range not satisfiable/i.test(String(error.message || ''));
}

function buildRangePageResult(data, total, page, limit) {
  const safeTotal = total ?? 0;
  return {
    data,
    count: safeTotal,
    page,
    limit,
    totalPages: safeTotal > 0 ? Math.ceil(safeTotal / limit) : 0,
  };
}

async function fetchHeadCount(buildQuery) {
  const { count: totalCount, error: countError } = await buildQuery({ head: true });
  if (countError) throw countError;
  return totalCount ?? 0;
}

/**
 * @param {(opts?: { head?: boolean }) => import('@supabase/postgrest-js').PostgrestFilterBuilder} buildQuery
 *   Builder con select, filtros y orden. Con `{ head: true }` debe usar count exact head (sin range).
 * @param {{ page: number, limit: number }} pagination
 */
async function fetchSupabaseRangePage(buildQuery, { page, limit }) {
  const offset = (page - 1) * limit;
  const rangeEnd = offset + limit - 1;

  const { data, error, count } = await buildQuery().range(offset, rangeEnd);

  if (isRangeNotSatisfiable(error)) {
    const total = await fetchHeadCount(buildQuery);
    return buildRangePageResult([], total, page, limit);
  }

  if (error) throw error;

  const rows = data ?? [];
  let total = count;

  // PostgREST a veces responde sin error: data=[], count=null en páginas fuera de rango.
  if (total == null || (rows.length === 0 && offset > 0)) {
    total = await fetchHeadCount(buildQuery);
  }

  return buildRangePageResult(rows, total, page, limit);
}

module.exports = { isRangeNotSatisfiable, fetchSupabaseRangePage, fetchHeadCount, buildRangePageResult };
