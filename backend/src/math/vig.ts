export interface TwoSidedMarket {
  impliedA: number;  // raw implied probability, side A
  impliedB: number;  // raw implied probability, side B
}

export interface NoVigMarket {
  fairA: number;     // vig-removed fair probability, side A
  fairB: number;     // vig-removed fair probability, side B
  overround: number; // total before normalization (e.g. 1.045 = 4.5% vig)
}

/**
 * Removes vig from a two-sided market by multiplicative normalization.
 * fairA + fairB will equal 1.0 (within floating-point precision).
 */
export function removeVig(market: TwoSidedMarket): NoVigMarket {
  const overround = market.impliedA + market.impliedB;
  return {
    fairA: market.impliedA / overround,
    fairB: market.impliedB / overround,
    overround,
  };
}
