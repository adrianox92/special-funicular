const { createMemorySupabase } = require('../helpers/memorySupabase');
const { insertReturnedComponentToInventory } = require('../../lib/inventoryReturnFromComponent');

describe('insertReturnedComponentToInventory', () => {
  test('fusiona el reingreso en la línea existente por part_id', async () => {
    const db = createMemorySupabase({
      inventory_items: [
        {
          id: 'inv-1',
          user_id: 'user-1',
          part_id: 'part-1',
          quantity: 2,
          notes: 'Cajón',
          category: 'pinion',
          name: 'Pinon 9',
          updated_at: '2026-01-01T00:00:00.000Z',
        },
      ],
      parts: [],
    });

    const result = await insertReturnedComponentToInventory(db, {
      userId: 'user-1',
      partId: 'part-1',
      vehicleLabel: 'Slot X',
      snapshot: {
        component_type: 'pinion',
        element: 'Pinon 9',
        manufacturer: 'Slot',
        sku: null,
        mounted_qty: 3,
        teeth: 9,
      },
    });

    expect(result.ok).toBe(true);
    expect(result.merged).toBe(true);
    expect(result.data.id).toBe('inv-1');
    expect(result.data.quantity).toBe(5);
    expect(db.snapshot('inventory_items')).toHaveLength(1);
    expect(result.data.notes).toMatch(/Reingreso de 3 uds/);
  });

  test('inserta una línea nueva si no hay part_id ni equivalente', async () => {
    const db = createMemorySupabase({
      inventory_items: [],
      parts: [],
    });

    db.from = ((origFrom) => (table) => {
      const builder = origFrom(table);
      if (table === 'parts') {
        const origInsert = builder.insert.bind(builder);
        builder.insert = (rows) => {
          const withKey = (Array.isArray(rows) ? rows : [rows]).map((r) => ({
            identity_key: r.identity_key || 'generated',
            ...r,
          }));
          return origInsert(withKey);
        };
      }
      return builder;
    })(db.from.bind(db));

    const result = await insertReturnedComponentToInventory(db, {
      userId: 'user-1',
      snapshot: {
        component_type: 'pinion',
        element: 'Pinon 9',
        manufacturer: 'Slot',
        sku: 'REF-1',
        mounted_qty: 1,
        teeth: 9,
      },
    });

    expect(result.ok).toBe(true);
    expect(result.merged).toBe(false);
    expect(db.snapshot('inventory_items')).toHaveLength(1);
    expect(db.snapshot('inventory_items')[0].quantity).toBe(1);
    expect(db.snapshot('inventory_items')[0].part_id).toBeTruthy();
  });
});
