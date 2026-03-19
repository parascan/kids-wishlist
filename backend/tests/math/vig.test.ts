import { describe, it, expect } from 'vitest';
import { removeVig } from '../../src/math/vig.js';

describe('removeVig', () => {
  it('normalizes standard -110/-110 market to 0.5/0.5', () => {
    const result = removeVig({ impliedA: 0.52381, impliedB: 0.52381 });
    expect(result.fairA).toBeCloseTo(0.5, 4);
    expect(result.fairB).toBeCloseTo(0.5, 4);
    expect(result.overround).toBeCloseTo(1.04762, 4);
  });

  it('normalizes asymmetric market correctly', () => {
    const result = removeVig({ impliedA: 0.6667, impliedB: 0.4 });
    expect(result.fairA).toBeCloseTo(0.6250, 4);
    expect(result.fairB).toBeCloseTo(0.3750, 4);
    expect(result.overround).toBeCloseTo(1.0667, 4);
  });

  it('handles no-vig market (sum already 1.0)', () => {
    const result = removeVig({ impliedA: 0.5, impliedB: 0.5 });
    expect(result.fairA).toBeCloseTo(0.5, 10);
    expect(result.fairB).toBeCloseTo(0.5, 10);
    expect(result.overround).toBeCloseTo(1.0, 10);
  });

  it('always produces fairA + fairB = 1.0', () => {
    const testCases = [
      { impliedA: 0.52381, impliedB: 0.52381 },
      { impliedA: 0.6667, impliedB: 0.4 },
      { impliedA: 0.8, impliedB: 0.3 },
      { impliedA: 0.55, impliedB: 0.55 },
    ];
    for (const market of testCases) {
      const result = removeVig(market);
      expect(result.fairA + result.fairB).toBeCloseTo(1.0, 10);
    }
  });
});
