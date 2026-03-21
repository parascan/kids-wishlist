import axios from 'axios';

const BASE = 'https://gamma-api.polymarket.com';

export interface PolymarketOdds {
  game_id: string;
  home_team: string;
  away_team: string;
  outcome: string;
  implied_prob: number;
  source: 'polymarket';
  bet_type: 'moneyline';
}

export async function fetchPolymarket(): Promise<PolymarketOdds[]> {
  const results: PolymarketOdds[] = [];
  try {
    const response = await axios.get(`${BASE}/markets`, {
      params: { tag: 'ncaa', active: true, limit: 100 },
      timeout: 8000,
    });

    const markets = response.data ?? [];
    for (const market of markets) {
      const question: string = market.question ?? '';
      if (!question.toLowerCase().includes('march madness') &&
          !question.toLowerCase().includes('ncaa') &&
          !question.toLowerCase().includes('win')) continue;

      // outcomePrices is an array of probability strings like ["0.65", "0.35"]
      const prices: string[] = market.outcomePrices ?? [];
      const outcomes: string[] = market.outcomes ?? [];

      if (prices.length !== 2 || outcomes.length !== 2) continue;

      const gameId = `polymarket-${market.conditionId ?? market.id}`;
      const [team1, team2] = outcomes;

      results.push({
        game_id: gameId,
        home_team: team2,
        away_team: team1,
        outcome: 'away',
        implied_prob: parseFloat(prices[0]),
        source: 'polymarket',
        bet_type: 'moneyline',
      });
      results.push({
        game_id: gameId,
        home_team: team2,
        away_team: team1,
        outcome: 'home',
        implied_prob: parseFloat(prices[1]),
        source: 'polymarket',
        bet_type: 'moneyline',
      });
    }
  } catch (err: any) {
    if (err.response?.status === 403 || err.code === 'ECONNREFUSED') {
      console.warn('[polymarket] geo-blocked or unavailable — skipping');
    } else {
      console.error('[polymarket] fetch failed:', err.message);
    }
  }
  return results;
}
