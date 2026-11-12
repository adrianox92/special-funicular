'use strict';

const crypto = require('crypto');

/**
 * Cliente mínimo con la cadena que usa mcpOauth (insert/select/update/eq/is/in).
 */
function createMemoryDb() {
  const tables = {
    mcp_oauth_clients: [],
    mcp_oauth_codes: [],
    mcp_oauth_tokens: [],
  };

  class Query {
    constructor(name) {
      this.name = name;
      this.action = 'select';
      this.payload = null;
      this.filters = [];
    }

    select() {
      return this;
    }

    insert(row) {
      this.action = 'insert';
      this.payload = { ...row };
      return this;
    }

    update(row) {
      this.action = 'update';
      this.payload = { ...row };
      return this;
    }

    eq(col, val) {
      this.filters.push(['eq', col, val]);
      return this;
    }

    is(col, val) {
      this.filters.push(['is', col, val]);
      return this;
    }

    in(col, vals) {
      this.filters.push(['in', col, vals]);
      return this;
    }

    match(row) {
      return this.filters.every(([op, col, val]) => {
        if (op === 'eq') return row[col] === val;
        if (op === 'is') return val == null ? row[col] == null : row[col] === val;
        if (op === 'in') return Array.isArray(val) && val.includes(row[col]);
        return false;
      });
    }

    run() {
      const table = tables[this.name];
      if (!table) return { data: null, error: { message: `tabla ${this.name}` } };
      if (this.action === 'insert') {
        const row = { id: crypto.randomUUID(), ...this.payload };
        table.push(row);
        return { data: row, error: null };
      }
      const hits = table.filter((row) => this.match(row));
      if (this.action === 'update') {
        hits.forEach((row) => Object.assign(row, this.payload));
        return { data: hits, error: null };
      }
      return { data: hits, error: null };
    }

    single() {
      return Promise.resolve(this.run());
    }

    maybeSingle() {
      const result = this.run();
      if (Array.isArray(result.data)) {
        return Promise.resolve({ data: result.data[0] || null, error: null });
      }
      return Promise.resolve(result);
    }

    then(resolve, reject) {
      return Promise.resolve(this.run()).then(resolve, reject);
    }
  }

  return {
    tables,
    from(name) {
      return new Query(name);
    },
  };
}

module.exports = { createMemoryDb };
