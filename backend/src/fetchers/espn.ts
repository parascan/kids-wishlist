import axios from 'axios';
import { americanToImplied } from '../math/index.js';
import { removeVig } from '../math/index.js';

const BASE = 'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball';

export interface EspnGame {
  game_id: string;
  home_team: string;
  away_team: string;
  game_time: string;
  status: string;
}

export interface EspnOdds {
  game_id: string;
  home_team: string;
  away_team: string;
  game_time: string;
  bet_type: 'spread' | 'totals' | 'moneyline';
  outcome: string;
  implied_prob: number;
  line_value?: number;
  source: 'espn';
}

async function fetchOddsForEvent(eventId: string, gameId: string, homeTeam: string, awayTeam: string, gameTime: string): Promise<EspnOdds[]> {
  const odds: EspnOdds[] = [];
  try {
    const res = await axios.get(`${BASE}/summary`, {
      params: { event: eventId },
      timeout: 8000,
    });
    const pickcenter: any[] = res.data?.pickcenter ?? [];
    if (!pickcenter.length) return odds;

    // Use first provider (DraftKings)
    const oddsData = pickcenter[0];

    // Moneyline
    const awayML = oddsData.awayTeamOdds?.moneyLine;
    const homeML = oddsData.homeTeamOdds?.moneyLine;
    if (awayML != null && homeML != null && !isNaN(awayML) && !isNaN(homeML)) {
      const rawAway = americanToImplied(awayML);
      const rawHome = americanToImplied(homeML);
      const { fairA: fairAway, fairB: fairHome } = removeVig({ impliedA: rawAway, impliedB: rawHome });
      odds.push({ game_id: gameId, home_team: homeTeam, away_team: awayTeam, game_time: gameTime, bet_type: 'moneyline', outcome: 'away', implied_prob: fairAway, source: 'espn' });
      odds.push({ game_id: gameId, home_team: homeTeam, away_team: awayTeam, game_time: gameTime, bet_type: 'moneyline', outcome: 'home', implied_prob: fairHome, source: 'espn' });
    }

    // Spread
    const spread = oddsData.spread;
    const awaySpreadML = oddsData.awayTeamOdds?.spreadOdds;
    const homeSpreadML = oddsData.homeTeamOdds?.spreadOdds;
    if (spread != null && awaySpreadML != null && homeSpreadML != null) {
      const rawAway = americanToImplied(awaySpreadML);
      const rawHome = americanToImplied(homeSpreadML);
      const { fairA: fairAway, fairB: fairHome } = removeVig({ impliedA: rawAway, impliedB: rawHome });
      odds.push({ game_id: gameId, home_team: homeTeam, away_team: awayTeam, game_time: gameTime, bet_type: 'spread', outcome: 'away', implied_prob: fairAway, line_value: -spread, source: 'espn' });
      odds.push({ game_id: gameId, home_team: homeTeam, away_team: awayTeam, game_time: gameTime, bet_type: 'spread', outcome: 'home', implied_prob: fairHome, line_value: spread, source: 'espn' });
    }

    // Totals (O/U)
    const total = oddsData.overUnder;
    const overML = oddsData.overOdds;
    const underML = oddsData.underOdds;
    if (total != null && overML != null && underML != null) {
      const rawOver = americanToImplied(overML);
      const rawUnder = americanToImplied(underML);
      const { fairA: fairOver, fairB: fairUnder } = removeVig({ impliedA: rawOver, impliedB: rawUnder });
      odds.push({ game_id: gameId, home_team: homeTeam, away_team: awayTeam, game_time: gameTime, bet_type: 'totals', outcome: 'over', implied_prob: fairOver, line_value: total, source: 'espn' });
      odds.push({ game_id: gameId, home_team: homeTeam, away_team: awayTeam, game_time: gameTime, bet_type: 'totals', outcome: 'under', implied_prob: fairUnder, line_value: total, source: 'espn' });
    }
  } catch (err: any) {
    console.warn(`[espn] odds fetch failed for ${eventId}:`, err.message);
  }
  return odds;
}

export async function fetchEspnGames(): Promise<{ games: EspnGame[]; odds: EspnOdds[] }> {
  const games: EspnGame[] = [];
  const allOdds: EspnOdds[] = [];

  try {
    const response = await axios.get(`${BASE}/scoreboard`, {
      params: { limit: 100, groups: 100 },
      timeout: 10000,
    });

    const events = response.data?.events ?? [];

    // Fetch odds in parallel for all non-final games
    const tasks = events
      .filter((event: any) => event.status?.type?.name !== 'STATUS_FINAL')
      .map(async (event: any) => {
        const competition = event.competitions?.[0];
        if (!competition) return;

        const homeComp = competition.competitors?.find((c: any) => c.homeAway === 'home');
        const awayComp = competition.competitors?.find((c: any) => c.homeAway === 'away');
        if (!homeComp || !awayComp) return;

        const homeTeam = homeComp.team?.displayName ?? homeComp.team?.name ?? 'Home';
        const awayTeam = awayComp.team?.displayName ?? awayComp.team?.name ?? 'Away';
        const gameId = `espn-${event.id}`;
        const gameTime = event.date ?? '';
        const statusType = event.status?.type?.name ?? '';

        games.push({ game_id: gameId, home_team: homeTeam, away_team: awayTeam, game_time: gameTime, status: statusType });

        const odds = await fetchOddsForEvent(event.id, gameId, homeTeam, awayTeam, gameTime);
        allOdds.push(...odds);
      });

    await Promise.all(tasks);
  } catch (err: any) {
    console.error('[espn] fetch failed:', err.message);
  }

  return { games, odds: allOdds };
}
