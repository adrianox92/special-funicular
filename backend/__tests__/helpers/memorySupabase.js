/**
 * Cliente Supabase en memoria para tests de stock / montaje.
 * Soporta las cadenas usadas por inventoryStockOps, mount y technical-specs.
 */

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function pickColumns(row, selectCols) {
  if (!selectCols || selectCols === '*' || selectCols === '') return { ...row };
  const cols = String(selectCols)
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean);
  const out = {};
  for (const col of cols) out[col] = row[col];
  return out;
}

function matchesFilters(row, filters) {
  for (const f of filters) {
    if (f.type === 'eq') {
      if (row[f.col] != f.val) return false;
    } else if (f.type === 'in') {
      const vals = f.vals || [];
      if (!vals.some((v) => row[f.col] == v)) return false;
    } else if (f.type === 'not') {
      if (f.op === 'is' && (f.val === null || f.val === 'null')) {
        if (row[f.col] == null) return false;
      } else if (row[f.col] == f.val) {
        return false;
      }
    }
  }
  return true;
}

function createMemorySupabase(initialTables = {}) {
  const tables = {};
  for (const [name, rows] of Object.entries(initialTables)) {
    tables[name] = clone(rows);
  }

  let idSeq = 1;
  const nextId = (prefix) => `${prefix}-${idSeq++}`;

  function from(table) {
    if (!tables[table]) tables[table] = [];

    const state = {
      table,
      filters: [],
      op: 'select',
      payload: null,
      selectCols: '*',
      orderBy: null,
      limitN: null,
    };

    const execute = async (mode) => {
      let rows = tables[state.table];
      const matchedIdx = [];
      rows.forEach((row, idx) => {
        if (matchesFilters(row, state.filters)) matchedIdx.push(idx);
      });

      let resultRows = matchedIdx.map((idx) => rows[idx]);

      if (state.op === 'insert') {
        const incoming = Array.isArray(state.payload) ? state.payload : [state.payload];
        const inserted = incoming.map((row) => {
          const withId = { ...row, id: row.id || nextId(state.table) };
          tables[state.table].push(withId);
          return withId;
        });
        resultRows = inserted;
      } else if (state.op === 'update') {
        const updated = [];
        for (const idx of matchedIdx) {
          tables[state.table][idx] = { ...tables[state.table][idx], ...state.payload };
          updated.push(tables[state.table][idx]);
        }
        resultRows = updated;
      } else if (state.op === 'delete') {
        const deleted = matchedIdx.map((idx) => rows[idx]);
        const remove = new Set(matchedIdx);
        tables[state.table] = rows.filter((_, idx) => !remove.has(idx));
        resultRows = deleted;
      }

      if (state.orderBy) {
        const { col, ascending } = state.orderBy;
        resultRows = [...resultRows].sort((a, b) => {
          const av = a[col];
          const bv = b[col];
          if (av == null && bv == null) return 0;
          if (av == null) return ascending ? -1 : 1;
          if (bv == null) return ascending ? 1 : -1;
          if (av < bv) return ascending ? -1 : 1;
          if (av > bv) return ascending ? 1 : -1;
          return 0;
        });
      }

      if (state.limitN != null) {
        resultRows = resultRows.slice(0, state.limitN);
      }

      const projected = resultRows.map((row) => pickColumns(row, state.selectCols));

      if (mode === 'single') {
        if (projected.length === 0) {
          return { data: null, error: { message: 'No rows' } };
        }
        return { data: clone(projected[0]), error: null };
      }
      if (mode === 'maybe') {
        return { data: projected[0] ? clone(projected[0]) : null, error: null };
      }
      return { data: clone(projected), error: null };
    };

    const builder = {
      select(cols) {
        state.selectCols = cols;
        return builder;
      },
      insert(rows) {
        state.op = 'insert';
        state.payload = rows;
        return builder;
      },
      update(patch) {
        state.op = 'update';
        state.payload = patch;
        return builder;
      },
      delete() {
        state.op = 'delete';
        return builder;
      },
      eq(col, val) {
        state.filters.push({ type: 'eq', col, val });
        return builder;
      },
      in(col, vals) {
        state.filters.push({ type: 'in', col, vals });
        return builder;
      },
      not(col, op, val) {
        state.filters.push({ type: 'not', col, op, val });
        return builder;
      },
      order(col, opts = {}) {
        state.orderBy = { col, ascending: opts.ascending !== false };
        return builder;
      },
      limit(n) {
        state.limitN = n;
        return builder;
      },
      maybeSingle() {
        return execute('maybe');
      },
      single() {
        return execute('single');
      },
      then(onFulfilled, onRejected) {
        return execute('many').then(onFulfilled, onRejected);
      },
    };

    return builder;
  }

  return {
    from,
    tables,
    snapshot(table) {
      return clone(tables[table] || []);
    },
  };
}

module.exports = { createMemorySupabase };
