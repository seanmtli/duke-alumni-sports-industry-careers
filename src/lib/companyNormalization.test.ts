import { describe, it, expect } from 'vitest';
import { normalizeCompany } from './companyNormalization';

describe('normalizeCompany', () => {
  it('collapses MLBPA name variants onto one display name', () => {
    expect(normalizeCompany('Major League Baseball Players Association')).toBe('MLBPA');
    expect(normalizeCompany('MLB Players Association')).toBe('MLBPA');
    expect(normalizeCompany('MLB Players Inc.')).toBe('MLBPA');
    expect(normalizeCompany('MLBPA')).toBe('MLBPA');
  });
});
