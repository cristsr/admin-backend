import { IanaTimeZone } from './iana-timezone';
import { InvalidTimeZoneException } from './value-object.exception';

describe('IanaTimeZone', () => {
  it('accepts zones the runtime knows', () => {
    expect(IanaTimeZone.of('America/Bogota').value).toBe('America/Bogota');
    expect(IanaTimeZone.of('UTC').value).toBe('UTC');
    expect(IanaTimeZone.of('America/New_York').value).toBe('America/New_York');
  });

  it('rejects a blank zone', () => {
    expect(() => IanaTimeZone.of('')).toThrow(InvalidTimeZoneException);
    expect(() => IanaTimeZone.of('   ')).toThrow(InvalidTimeZoneException);
  });

  it('rejects a zone the runtime does not know', () => {
    expect(() => IanaTimeZone.of('Invalid/Zone')).toThrow(InvalidTimeZoneException);
    expect(() => IanaTimeZone.of('Bogota')).toThrow(InvalidTimeZoneException);
    expect(() => IanaTimeZone.of('America/NotACity')).toThrow(InvalidTimeZoneException);
  });

  it('compares by value', () => {
    expect(IanaTimeZone.of('America/Bogota').equals(IanaTimeZone.of('America/Bogota'))).toBe(true);
    expect(IanaTimeZone.of('America/Bogota').equals(IanaTimeZone.of('UTC'))).toBe(false);
  });
});
