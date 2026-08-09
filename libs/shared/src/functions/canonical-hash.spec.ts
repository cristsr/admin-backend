import { canonicalJson, sha256Hex } from './canonical-hash';

describe('canonicalJson (RFC 8785 / JCS)', () => {
  it('produces the same string regardless of key insertion order', async () => {
    const a = await canonicalJson({ b: 1, a: 2 });
    const b = await canonicalJson({ a: 2, b: 1 });

    expect(a).toBe(b);
    expect(a).toBe('{"a":2,"b":1}');
  });

  it('sorts keys by UTF-16 code unit — documented RFC 8785 example', async () => {
    const result = await canonicalJson({
      peach: 'This sorting order',
      punkt: 'is heavily used',
      pinkie: 'in Postal Code sorting!',
    });

    expect(result).toBe(
      '{"peach":"This sorting order","pinkie":"in Postal Code sorting!","punkt":"is heavily used"}',
    );
  });

  it('sorts keys recursively in nested objects', async () => {
    const result = await canonicalJson({ z: { d: 1, c: 2 }, a: 1 });

    expect(result).toBe('{"a":1,"z":{"c":2,"d":1}}');
  });

  it('preserves array order (arrays are not reordered)', async () => {
    const result = await canonicalJson({ list: [3, 1, 2] });

    expect(result).toBe('{"list":[3,1,2]}');
  });

  it('passes decimal amount strings through untouched (RNF-2 — never parsed to number)', async () => {
    const result = await canonicalJson({ amount: '-31900', usd: '7.99' });

    expect(result).toBe('{"amount":"-31900","usd":"7.99"}');
  });

  it('is stable across repeated calls for the same value', async () => {
    const value = { postings: [{ amount: '100', currency: 'COP' }], date: '2026-07-20' };

    const first = await canonicalJson(value);
    const second = await canonicalJson(value);

    expect(first).toBe(second);
  });
});

describe('sha256Hex', () => {
  it('matches the well-known SHA-256 vector for the empty string', () => {
    expect(sha256Hex('')).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
  });

  it('matches the well-known SHA-256 vector for "abc"', () => {
    expect(sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('always returns 64 lowercase hex characters', () => {
    const digest = sha256Hex('anything');

    expect(digest).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic', () => {
    expect(sha256Hex('same input')).toBe(sha256Hex('same input'));
  });
});
