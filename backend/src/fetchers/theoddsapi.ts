import axios from 'axios';
import { americanToImplied, removeVig } from '../math/index.js';

const BASE = 'https://api.the-odds-api.com/v4';

const SPORTS: { key: string; apiKey: string }[] = [
  { key: 'NBA',   apiKey: 'basketball_nba' },
  { key: 'MLB',   apiKey: 'baseball_mlb' },
  { key: 'NHL',   apiKey: 'icehockey_nhl' },
  { key: 'NCAAB', apiKey: 'basketball_ncaab' },
  { key: 'NCAAF', apiKey: 'americanfootball_ncaaf' },
];

// Books to pull — ordered by sharpness
const BOOKMAKERS = ['draftkings', 'fanduel', 'betmgm', 'caesars', 'pointsbet', 'williamhill_us', 'bovada'];

export interface OddsApiOdds {
  game_id: string;
  home_team: string;
  away_team: string;
  game_time: string;
  sport: string;
  bet_type: 'moneyline' | 'spread' | 'totals';
  outcome: string;
  implied_prob: number;
  line_value?: number;
  source: string;
}

async function fetchSport(apiSportKey: string, sportKey: string, authKey: string): Promise<OddsApiOdds[]> {
  const results: OddsApiOdds[] = [];
  try {
    const response = await axios.get(`${BASE}/sports/${apiSportKey}/odds`, {
      params: {
        apiKey: authKey,
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
            const homeO = outcomes.find((o: any) => o.name === homeTeam);
            const awayO = outcomes.find((o: any) => o.name === awayTeam);
            if (!homeO || !awayO) continue;
            const { fairA: fairAway, fairB: fairHome } = removeVig({
              impliedA: americanToImplied(awayO.price),
              impliedB: americanToImplied(homeO.price),
            });
            results.push({ game_id: gameId, home_team: homeTeam, away_team: awayTeam, game_time: gameTime, sport: sportKey, bet_type: 'moneyline', outcome: 'away', implied_prob: fairAway, source });
            results.push({ game_id: gameId, home_team: homeTeam, away_team: awayTeam, game_time: gameTime, sport: sportKey, bet_type: 'moneyline', outcome: 'home', implied_prob: fairHome, source });
          } else if (market.key === 'spreads') {
            const outcomes: any[] = market.outcomes ?? [];
            const homeO = outcomes.find((o: any) => o.name === homeTeam);
            const awayO = outcomes.find((o: any) => o.name === awayTeam);
            if (!homeO || !awayO) continue;
            const { fairA: fairAway, fairB: fairHome } = removeVig({
              impliedA: americanToImplied(awayO.price),
              impliedB: americanToImplied(homeO.price),
            });
            results.push({ game_id: gameId, home_team: homeTeam, away_team: awayTeam, game_time: gameTime, sport: sportKey, bet_type: 'spread', outcome: 'away', implied_prob: fairAway, line_value: awayO.point, source });
            results.push({ game_id: gameId, home_team: homeTeam, away_team: awayTeam, game_time: gameTime, sport: sportKey, bet_type: 'spread', outcome: 'home', implied_prob: fairHome, line_value: homeO.point, source });
          } else if (market.key === 'totals') {
            const outcomes: any[] = market.outcomes ?? [];
            const overO = outcomes.find((o: any) => o.name === 'Over');
            const underO = outcomes.find((o: any) => o.name === 'Under');
            if (!overO || !underO) continue;
            const { fairA: fairOver, fairB: fairUnder } = removeVig({
              impliedA: americanToImplied(overO.price),
              impliedB: americanToImplied(underO.price),
            });
            results.push({ game_id: gameId, home_team: homeTeam, away_team: awayTeam, game_time: gameTime, sport: sportKey, bet_type: 'totals', outcome: 'over', implied_prob: fairOver, line_value: overO.point, source });
            results.push({ game_id: gameId, home_team: homeTeam, away_team: awayTeam, game_time: gameTime, sport: sportKey, bet_type: 'totals', outcome: 'under', implied_prob: fairUnder, line_value: underO.point, source });
          }
        }
      }
    }

    const remaining = response.headers['x-requests-remaining'];
    if (remaining) console.log(`[theoddsapi:${sportKey}] requests remaining: ${remaining}`);
  } catch (err: any) {
    if (err.response?.status !== 422) {
      console.warn(`[theoddsapi:${sportKey}] fetch failed:`, err.response?.data ?? err.message);
    }
  }
  return results;
}

export async function fetchTheOddsApi(authKey: string): Promise<OddsApiOdds[]> {
  const results = await Promise.all(
    SPORTS.map(s => fetchSport(s.apiKey, s.key, authKey))
  );
  return results.flat();
}
