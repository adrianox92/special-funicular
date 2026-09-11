const { createMemorySupabase } = require('../helpers/memorySupabase');
const {
  consumeInventoryStock,
  deductPartStockFifo,
  restoreStockDeductions,
  getPartStock,
} = require('../../lib/inventoryStockOps');

const USER = 'user-1';
const PART = 'part-1';

function seedTwoLines(qtyA = 2, qtyB = 3) {
  return createMemorySupabase({
    inventory_items: [
      {
        id: 'inv-a',
        user_id: USER,
        part_id: PART,
        quantity: qtyA,
        name: 'Pinon 9',
        created_at: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'inv-b',
        user_id: USER,
        part_id: PART,
        quantity: qtyB,
        name: 'Pinon 9',
        created_at: '2026-01-02T00:00:00.000Z',
      },
    ],
  });
}

describe('inventoryStockOps', () => {
  test('FIFO descuenta en orden de created_at a través de 2 líneas', async () => {
    const db = seedTwoLines(2, 3);
    const result = await consumeInventoryStock(db, {
      userId: USER,
      partId: PART,
      itemId: 'inv-b',
      qty: 4,
    });

    expect(result.ok).toBe(true);
    expect(result.deductedQty).toBe(4);
    expect(result.sourceInventoryItemId).toBe('inv-a');
    expect(result.deductions).toEqual([
      { itemId: 'inv-a', qty: 2, newQuantity: 0 },
      { itemId: 'inv-b', qty: 2, newQuantity: 1 },
    ]);

    const stock = await getPartStock(db, USER, PART);
    expect(stock.stockQty).toBe(1);
    expect(stock.lines.find((l) => l.id === 'inv-a').quantity).toBe(0);
    expect(stock.lines.find((l) => l.id === 'inv-b').quantity).toBe(1);
  });

  test('stock insuficiente no deja descuentos a medias', async () => {
    const db = seedTwoLines(1, 1);
    const result = await consumeInventoryStock(db, {
      userId: USER,
      partId: PART,
      qty: 5,
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
    expect(result.code).toBe('INSUFFICIENT_STOCK');
    expect(result.error).toMatch(/Stock insuficiente/);

    const stock = await getPartStock(db, USER, PART);
    expect(stock.stockQty).toBe(2);
  });

  test('sin part_id descuenta solo la línea concreta', async () => {
    const db = seedTwoLines(2, 3);
    const result = await consumeInventoryStock(db, {
      userId: USER,
      itemId: 'inv-b',
      qty: 2,
    });

    expect(result.ok).toBe(true);
    expect(result.sourceInventoryItemId).toBe('inv-b');
    const stock = await getPartStock(db, USER, PART);
    expect(stock.lines.find((l) => l.id === 'inv-a').quantity).toBe(2);
    expect(stock.lines.find((l) => l.id === 'inv-b').quantity).toBe(1);
  });

  test('restoreStockDeductions revierte FIFO', async () => {
    const db = seedTwoLines(2, 3);
    const fifo = await deductPartStockFifo(db, { userId: USER, partId: PART, qty: 3 });
    expect(fifo.ok).toBe(true);
    await restoreStockDeductions(db, USER, fifo.deductions);
    const stock = await getPartStock(db, USER, PART);
    expect(stock.stockQty).toBe(5);
  });

  test('aumento de qty con línea origen agotada usa FIFO del resto', async () => {
    const db = seedTwoLines(0, 3);
    const result = await consumeInventoryStock(db, {
      userId: USER,
      partId: PART,
      itemId: 'inv-a',
      qty: 1,
    });

    expect(result.ok).toBe(true);
    expect(result.sourceInventoryItemId).toBe('inv-b');
    expect(db.snapshot('inventory_items').find((l) => l.id === 'inv-b').quantity).toBe(2);
    expect(db.snapshot('inventory_items').find((l) => l.id === 'inv-a').quantity).toBe(0);
  });
});
