import { STAR_CATALOG } from '../src/data/starCatalog';
import { CONSTELLATION_LINES } from '../src/data/constellationLines';

describe('STAR_CATALOG', () => {
  it('has exactly 8911 entries', () => {
    expect(STAR_CATALOG.length).toBe(8911);
  });

  it('has no NaN or undefined RA, Dec, or magnitude values', () => {
    for (const [, ra, dec, mag] of STAR_CATALOG) {
      expect(Number.isFinite(ra)).toBe(true);
      expect(Number.isFinite(dec)).toBe(true);
      expect(Number.isFinite(mag)).toBe(true);
    }
  });
});

describe('CONSTELLATION_LINES', () => {
  const catalogHips = new Set(STAR_CATALOG.map(([hipId]) => hipId));
  const KNOWN_MISSING_HIPS = new Set([33165]);

  it('resolves every hipId against the catalog except the known sub-6.5-mag gap', () => {
    const missing = new Set<number>();
    for (const [hipA, hipB] of CONSTELLATION_LINES) {
      if (!catalogHips.has(hipA)) missing.add(hipA);
      if (!catalogHips.has(hipB)) missing.add(hipB);
    }
    expect(missing).toEqual(KNOWN_MISSING_HIPS);
  });
});