import { InvalidTimeZoneException } from '../exceptions';
import { IanaTimeZone } from './iana-timezone.vo';

describe('IanaTimeZone (Value Object)', () => {
  describe('of()', () => {
    it('should accept valid IANA timezone identifiers', () => {
      const bogota = IanaTimeZone.of('America/Bogota');
      const utc = IanaTimeZone.of('UTC');
      const ny = IanaTimeZone.of('America/New_York');

      expect(bogota.toString()).toBe('America/Bogota');
      expect(utc.toString()).toBe('UTC');
      expect(ny.toString()).toBe('America/New_York');
    });

    it('should reject empty string', () => {
      expect(() => IanaTimeZone.of('')).toThrow(InvalidTimeZoneException);
    });

    it('should reject whitespace-only string', () => {
      expect(() => IanaTimeZone.of('   ')).toThrow(InvalidTimeZoneException);
    });

    it('should reject invalid timezone identifiers', () => {
      expect(() => IanaTimeZone.of('Invalid/Zone')).toThrow(InvalidTimeZoneException);
      expect(() => IanaTimeZone.of('Bogota')).toThrow(InvalidTimeZoneException);
      expect(() => IanaTimeZone.of('America/NotACity')).toThrow(InvalidTimeZoneException);
    });

    it('should validate using Intl API', () => {
      // This relies on the Intl API, so we test a few known-good zones
      const zones = ['UTC', 'America/Bogota', 'Europe/London', 'Asia/Tokyo'];
      zones.forEach(zone => {
        expect(() => IanaTimeZone.of(zone)).not.toThrow();
      });
    });
  });

  describe('equals()', () => {
    it('should return true for identical timezones', () => {
      const bogota1 = IanaTimeZone.of('America/Bogota');
      const bogota2 = IanaTimeZone.of('America/Bogota');
      expect(bogota1.equals(bogota2)).toBe(true);
    });

    it('should return false for different timezones', () => {
      const bogota = IanaTimeZone.of('America/Bogota');
      const utc = IanaTimeZone.of('UTC');
      expect(bogota.equals(utc)).toBe(false);
    });

    it('should return false for null/undefined', () => {
      const bogota = IanaTimeZone.of('America/Bogota');
      expect(bogota.equals(null)).toBe(false);
      expect(bogota.equals(undefined)).toBe(false);
    });
  });

  describe('toString()', () => {
    it('should return the timezone string', () => {
      const bogota = IanaTimeZone.of('America/Bogota');
      expect(bogota.toString()).toBe('America/Bogota');
    });
  });
});
