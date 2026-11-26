jest.mock('../../lib/priceWatchMatch', () => ({
  matchStoredOffer: jest.fn(),
}));

const { matchStoredOffer } = require('../../lib/priceWatchMatch');
const { createSupabaseShopOfferIo } = require('../../lib/shopOfferSync');

function adminThatUpdates() {
  const eq = jest.fn().mockResolvedValue({ error: null });
  const update = jest.fn(() => ({ eq }));
  return { from: jest.fn(() => ({ update })) };
}

describe('createSupabaseShopOfferIo y avisos de precio', () => {
  beforeEach(() => {
    matchStoredOffer.mockReset();
  });

  test('tras guardar una oferta en stock llama al matcher', async () => {
    matchStoredOffer.mockResolvedValue([]);
    const admin = adminThatUpdates();
    const io = createSupabaseShopOfferIo(admin);
    await io.updateOffer('off-1', { in_stock: true, price: 12.5 });
    expect(matchStoredOffer).toHaveBeenCalledWith(admin, 'off-1');
  });

  test('sin stock no llama al matcher', async () => {
    const admin = adminThatUpdates();
    const io = createSupabaseShopOfferIo(admin);
    await io.updateOffer('off-1', { in_stock: false, price: 12.5 });
    expect(matchStoredOffer).not.toHaveBeenCalled();
  });

  test('un fallo del matcher no relanza', async () => {
    matchStoredOffer.mockRejectedValue(new Error('aviso'));
    const admin = adminThatUpdates();
    const io = createSupabaseShopOfferIo(admin);
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(io.updateOffer('off-1', { in_stock: true, price: 9 })).resolves.toBeUndefined();
    spy.mockRestore();
  });
});
