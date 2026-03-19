import { describe, it, expect } from 'vitest';
import { simpleConsensus } from '../../src/math/consensus.js';

describe('simpleConsensus', () => {
  it('averages three sources: [0.62, 0.60, 0.61] -> 0.61', () => {
    expect(simpleConsensus([0.62, 0.60, 0.61])).toBeCloseTo(0.61, 10);
  });

  it('averages two sources (Polymarket absent): [0.62, 0.60] -> 0.61', () => {
    expect(simpleConsensus([0.62, 0.60])).toBeCloseTo(0.61, 10);
  });

  it('returns single source as-is: [0.60] -> 0.60', () => {
    expect(simpleConsensus([0.60])).toBeCloseTo(0.60, 10);
  });

  it('throws Error on empty array', () => {
    expect(() => simpleConsensus([])).toThrow('Cannot compute consensus');
  });

  it('handles boundary probabilities: [0.0, 1.0] -> 0.5', () => {
    expect(simpleConsensus([0.0, 1.0])).toBeCloseTo(0.5, 10);
  });
});
