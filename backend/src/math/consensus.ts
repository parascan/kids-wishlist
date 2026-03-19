/**
 * Computes consensus fair probability as simple average.
 * Accepts variable-length array; handles N=1 gracefully.
 * Throws if sources is empty -- consensus of zero sources is undefined.
 */
export function simpleConsensus(fairProbs: number[]): number {
  if (fairProbs.length === 0) {
    throw new Error('Cannot compute consensus: no source probabilities provided');
  }
  return fairProbs.reduce((sum, p) => sum + p, 0) / fairProbs.length;
}
