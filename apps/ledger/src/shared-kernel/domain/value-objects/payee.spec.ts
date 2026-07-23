import { Payee } from './payee';

describe('Payee', () => {
  it('trims surrounding whitespace', () => {
    expect(Payee.of('  Netflix  ')?.value).toBe('Netflix');
  });

  it('collapses blank input to null', () => {
    expect(Payee.of(null)).toBeNull();
    expect(Payee.of('')).toBeNull();
    expect(Payee.of('   ')).toBeNull();
  });

  it('rejects values longer than the bound', () => {
    const tooLong = 'x'.repeat(256);

    expect(() => Payee.of(tooLong)).toThrow();
  });
});
