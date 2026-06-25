import { describe, expect, it } from 'vitest';
import { toCssUnit } from './units';

describe('toCssUnit', () => {
  it('returns undefined for undefined', () => {
    expect(toCssUnit(undefined)).toBeUndefined();
  });
  it('appends px to numbers', () => {
    expect(toCssUnit(16)).toBe('16px');
    expect(toCssUnit(0)).toBe('0px');
  });
  it('passes strings through', () => {
    expect(toCssUnit('1rem')).toBe('1rem');
  });
});
