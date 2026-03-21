import axios from 'axios';

const BASE = 'https://trading-api.kalshi.com/trade-api/v2';

export interface KalshiOdds {
  game_id: string;
  home_team: string;
  away_team: string;
  outcome: string;   // 'home' | 'away'
  implied_prob: number;
  source: 'kalshi';
  bet_type: 'moneyline';
}

export async function fetchKalshi(apiKey: string): Promise<KalshiOdds[]> {
  const results: KalshiOdds[] = [];
  try {
    // Fetch NCAA basketball markets
    const response = await axios.get(`${BASE}/markets`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      params: {
        limit: 100,
        status: 'open',
        series_ticker: 'NCAAB',
      },
      timeout: 10000,
    });

    const markets = response.data?.markets ?? [];

    for (const market of markets) {
      // Market ticker like NCAAB-DUKE-UNC-20260320 or similar
      // yes_bid/yes_ask prices are probabilities (0-100 cents = 0-1 prob)
      const ticker: string = market.ticker ?? '';
      if (!ticker.startsWith('NCAAB')) continue;

      const yesPrice: number = (market.yes_bid + market.yes_ask) / 2 / 100;
      const noPrice = 1 - yesPrice;

      // Parse teams from ticker — format varies, use title as fallback
      const title: string = market.title ?? ticker;
      const parts = title.split(' vs ').map((s: string) => s.trim());
      const homeTeam = parts[1] ?? 'Home';
      const awayTeam = parts[0] ?? 'Away';
      const gameId = `kalshi-${ticker}`;

      if (yesPrice > 0 && yesPrice < 1) {
        results.push({
          game_id: gameId,
          home_team: homeTeam,
          away_team: awayTeam,
          outcome: 'away',  // "yes" = away team wins (first team listed)
          implied_prob: yesPrice,
          source: 'kalshi',
          bet_type: 'moneyline',
        });
        results.push({
          game_id: gameId,
          home_team: homeTeam,
          away_team: awayTeam,
          outcome: 'home',
          implied_prob: noPrice,
          source: 'kalshi',
          bet_type: 'moneyline',
        });
      }
    }
  } catch (err: any) {
    console.error('[kalshi] fetch failed:', err.message);
  }
  return results;
}
