/**
 * Converts American moneyline odds to implied probability.
 * Positive odds (underdog): p = 100 / (odds + 100)
 * Negative odds (favorite): p = |odds| / (|odds| + 100)
 * Returns probability in [0, 1].
 * Throws RangeError if odds === 0.
 */
export function americanToImplied(odds: number): number {
  if (odds === 0) {
    throw new RangeError('American odds of 0 is not valid');
  }
  if (odds > 0) {
    return 100 / (odds + 100);
  } else {
    const abs = Math.abs(odds);
    return abs / (abs + 100);
  }
}

/**
 * Converts implied probability to American moneyline odds.
 * p must be in (0, 1) exclusive.
 * Returns negative odds for p >= 0.5, positive for p < 0.5.
 */
export function impliedToAmerican(p: number): number {
  if (p >= 0.5) {
    return -(p / (1 - p)) * 100;
  } else {
    return ((1 - p) / p) * 100;
  }
}
