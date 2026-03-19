import { describe, it, expect } from 'vitest';
import { americanToImplied, impliedToAmerican } from '../../src/math/odds.js';

describe('americanToImplied', () => {
  it('converts positive odds (underdog): +150 -> 0.4', () => {
    expect(americanToImplied(150)).toBeCloseTo(0.4, 10);
  });

  it('converts negative odds (favorite): -200 -> 0.6667', () => {
    expect(americanToImplied(-200)).toBeCloseTo(0.6667, 4);
  });

  it('converts typical spread line: -110 -> 0.5238', () => {
    expect(americanToImplied(-110)).toBeCloseTo(0.5238, 4);
  });

  it('converts even money positive: +100 -> 0.5', () => {
    expect(americanToImplied(100)).toBeCloseTo(0.5, 10);
  });

  it('converts even money negative: -100 -> 0.5', () => {
    expect(americanToImplied(-100)).toBeCloseTo(0.5, 10);
  });

  it('converts big underdog: +300 -> 0.25', () => {
    expect(americanToImplied(300)).toBeCloseTo(0.25, 10);
  });

  it('throws RangeError for odds of 0', () => {
    expect(() => americanToImplied(0)).toThrow(RangeError);
  });

  it('handles heavy favorite: -10000 -> ~0.9901', () => {
    expect(americanToImplied(-10000)).toBeCloseTo(0.9901, 4);
  });

  it('handles heavy underdog: +10000 -> ~0.0099', () => {
    expect(americanToImplied(10000)).toBeCloseTo(0.0099, 4);
  });
});

describe('impliedToAmerican', () => {
  it('converts >= 50% probability to negative odds: 0.6667 -> ~-200', () => {
    expect(impliedToAmerican(0.6667)).toBeCloseTo(-200, 0);
  });

  it('converts < 50% probability to positive odds: 0.4 -> +150', () => {
    expect(impliedToAmerican(0.4)).toBeCloseTo(150, 0);
  });

  it('converts 50% to -100', () => {
    expect(impliedToAmerican(0.5)).toBeCloseTo(-100, 0);
  });

  it('round-trips: americanToImplied(impliedToAmerican(p)) ≈ p', () => {
    const p = 0.35;
    expect(americanToImplied(impliedToAmerican(p))).toBeCloseTo(p, 10);
  });
});
