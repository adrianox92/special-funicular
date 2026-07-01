const { linkPersonalCircuitToClub } = require('../../lib/clubCircuits');

describe('linkPersonalCircuitToClub', () => {
  it('rechaza si el circuito personal y el del club son el mismo id', async () => {
    const result = await linkPersonalCircuitToClub(
      {},
      {
        userId: 'user-1',
        clubId: 'club-1',
        clubCircuitId: 'circuit-a',
        personalCircuitId: 'circuit-a',
      },
    );
    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
  });
});
