import axios from 'axios';
import { americanToImplied } from '../math/index.js';
import { removeVig } from '../math/index.js';

const BASE = 'https://api.the-odds-api.com/v4';
const SPORT = 'basketball_ncaab';

// Books to pull — ordered by sharpness
const BOOKMAKERS = ['draftkings', 'fanduel', 'betmgm', 'caesars', 'pointsbet', 'williamhill_us', 'bovada'];

export interface OddsApiOdds {
  game_id: string;
  home_team: string;
  away_team: string;
  game_time: string;
  bet_type: 'moneyline' | 'spread' | 'totals';
  outcome: string;
  implied_prob: number;
  line_value?: number;
  source: string; // e.g. 'draftkings', 'fanduel'
}

export async function fetchTheOddsApi(apiKey: string): Promise<OddsApiOdds[]> {
  const results: OddsApiOdds[] = [];
  try {
    const response = await axios.get(`${BASE}/sports/${SPORT}/odds`, {
      params: {
        apiKey,
        regions: 'us',
        markets: 'h2h,spreads,totals',
        oddsFormat: 'american',
        bookmakers: BOOKMAKERS.join(','),
      },
      timeout: 12000,
    });

    const games: any[] = response.data ?? [];
    for (const game of games) {
      const gameId = `oddsapi-${game.id}`;
      const homeTeam: string = game.home_team;
      const awayTeam: string = game.away_team;
      const gameTime: string = game.commence_time ?? '';

      for (const bookmaker of (game.bookmakers ?? [])) {
        const source: string = bookmaker.key;
        for (const market of (bookmaker.markets ?? [])) {
          if (market.key === 'h2h') {
            const outcomes: any[] = market.outcomes ?? [];
            const homeOutcome = outcomes.find((o: any) => o.name === homeTeam);
            const awayOutcome = outcomes.find((o: any) => o.name === awayTeam);
            if (!homeOutcome || !awayOutcome) continue;
            const rawHome = americanToImplied(homeOutcome.price);
            const rawAway = americanToImplied(awayOutcome.price);
            const { fairA: fairAway, fairB: fairHome } = removeVig({ impliedA: rawAway, impliedB: rawHome });
            results.push({ game_id: gameId, home_team: homeTeam, away_team: awayTeam, game_time: gameTime, bet_type: 'moneyline', outcome: 'away', implied_prob: fairAway, source });
            results.push({ game_id: gameId, home_team: homeTeam, away_team: awayTeam, game_time: gameTime, bet_type: 'moneyline', outcome: 'home', implied_prob: fairHome, source });
          } else if (market.key === 'spreads') {
            const outcomes: any[] = market.outcomes ?? [];
            const homeOutcome = outcomes.find((o: any) => o.name === homeTeam);
            const awayOutcome = outcomes.find((o: any) => o.name === awayTeam);
            if (!homeOutcome || !awayOutcome) continue;
            const rawHome = americanToImplied(homeOutcome.price);
            const rawAway = americanToImplied(awayOutcome.price);
            const { fairA: fairAway, fairB: fairHome } = removeVig({ impliedA: rawAway, impliedB: rawHome });
            results.push({ game_id: gameId, home_team: homeTeam, away_team: awayTeam, game_time: gameTime, bet_type: 'spread', outcome: 'away', implied_prob: fairAway, line_value: awayOutcome.point, source });
            results.push({ game_id: gameId, home_team: homeTeam, away_team: awayTeam, game_time: gameTime, bet_type: 'spread', outcome: 'home', implied_prob: fairHome, line_value: homeOutcome.point, source });
          } else if (market.key === 'totals') {
            const outcomes: any[] = market.outcomes ?? [];
            const overOutcome = outcomes.find((o: any) => o.name === 'Over');
            const underOutcome = outcomes.find((o: any) => o.name === 'Under');
            if (!overOutcome || !underOutcome) continue;
            const rawOver = americanToImplied(overOutcome.price);
            const rawUnder = americanToImplied(underOutcome.price);
            const { fairA: fairOver, fairB: fairUnder } = removeVig({ impliedA: rawOver, impliedB: rawUnder });
            results.push({ game_id: gameId, home_team: homeTeam, away_team: awayTeam, game_time: gameTime, bet_type: 'totals', outcome: 'over', implied_prob: fairOver, line_value: overOutcome.point, source });
            results.push({ game_id: gameId, home_team: homeTeam, away_team: awayTeam, game_time: gameTime, bet_type: 'totals', outcome: 'under', implied_prob: fairUnder, line_value: underOutcome.point, source });
          }
        }
      }
    }

    const remaining = response.headers['x-requests-remaining'];
    if (remaining) console.log(`[theoddsapi] requests remaining: ${remaining}`);
  } catch (err: any) {
    console.error('[theoddsapi] fetch failed:', err.response?.data ?? err.message);
  }
  return results;
}
