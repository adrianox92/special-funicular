const { parseCsvAuto, csvToObjects, stripBom } = require('../../lib/csvTimingParse');

describe('csvTimingParse', () => {
  it('strips UTF-8 BOM', () => {
    expect(stripBom('\uFEFFa,b')).toBe('a,b');
  });

  it('parses semicolon-separated CSV', () => {
    const s = 'posición;vueltas;1;2\n1;2;0:10.000;0:11.000\n';
    const rows = parseCsvAuto(s);
    expect(rows.length).toBe(2);
    expect(rows[0]).toEqual(['posición', 'vueltas', '1', '2']);
    expect(rows[1][1]).toBe('2');
  });

  it('csvToObjects maps headers to row objects', () => {
    const s = 'a;b\n1;2\n';
    const objs = csvToObjects(s);
    expect(objs).toEqual([{ a: '1', b: '2' }]);
  });
});
