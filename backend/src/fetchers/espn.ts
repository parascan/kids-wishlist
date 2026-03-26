import axios from 'axios';
import { americanToImplied, removeVig } from '../math/index.js';

const BASE = 'https://site.api.espn.com/apis/site/v2/sports';

const SPORTS: { key: string; path: string; scoreboardParams?: Record<string, any> }[] = [
  { key: 'NBA',   path: 'basketball/nba' },
  { key: 'MLB',   path: 'baseball/mlb' },
  { key: 'NHL',   path: 'hockey/nhl' },
  { key: 'NCAAB', path: 'basketball/mens-college-basketball', scoreboardParams: { limit: 100, groups: 100 } },
  { key: 'NCAAF', path: 'football/college-football', scoreboardParams: { limit: 100, groups: 80 } },
];

export interface EspnGame {
  game_id: string;
  home_team: string;
  away_team: string;
  game_time: string;
  status: string;
  sport: string;
}

export interface EspnOdds {
  game_id: string;
  home_team: string;
  away_team: string;
  game_time: string;
  sport: string;
  bet_type: 'spread' | 'totals' | 'moneyline';
  outcome: string;
  implied_prob: number;
  line_value?: number;
  source: 'espn';
}

async function fetchOddsForEvent(
  sportPath: string, sport: string,
  eventId: string, gameId: string,
  homeTeam: string, awayTeam: string, gameTime: string
): Promise<EspnOdds[]> {
  const odds: EspnOdds[] = [];
  try {
    const res = await axios.get(`${BASE}/${sportPath}/summary`, {
      params: { event: eventId },
      timeout: 8000,
    });
    const pickcenter: any[] = res.data?.pickcenter ?? [];
    if (!pickcenter.length) return odds;

    const od = pickcenter[0];

    // Moneyline
    const awayML = od.awayTeamOdds?.moneyLine;
    const homeML = od.homeTeamOdds?.moneyLine;
    if (awayML != null && homeML != null && !isNaN(awayML) && !isNaN(homeML)) {
      const { fairA: fairAway, fairB: fairHome } = removeVig({
        impliedA: americanToImplied(awayML),
        impliedB: americanToImplied(homeML),
      });
      odds.push({ game_id: gameId, home_team: homeTeam, away_team: awayTeam, game_time: gameTime, sport, bet_type: 'moneyline', outcome: 'away', implied_prob: fairAway, source: 'espn' });
      odds.push({ game_id: gameId, home_team: homeTeam, away_team: awayTeam, game_time: gameTime, sport, bet_type: 'moneyline', outcome: 'home', implied_prob: fairHome, source: 'espn' });
    }

    // Spread
    const spread = od.spread;
    const awaySpreadML = od.awayTeamOdds?.spreadOdds;
    const homeSpreadML = od.homeTeamOdds?.spreadOdds;
    if (spread != null && awaySpreadML != null && homeSpreadML != null) {
      const { fairA: fairAway, fairB: fairHome } = removeVig({
        impliedA: americanToImplied(awaySpreadML),
        impliedB: americanToImplied(homeSpreadML),
      });
      odds.push({ game_id: gameId, home_team: homeTeam, away_team: awayTeam, game_time: gameTime, sport, bet_type: 'spread', outcome: 'away', implied_prob: fairAway, line_value: -spread, source: 'espn' });
      odds.push({ game_id: gameId, home_team: homeTeam, away_team: awayTeam, game_time: gameTime, sport, bet_type: 'spread', outcome: 'home', implied_prob: fairHome, line_value: spread, source: 'espn' });
    }

    // Totals
    const total = od.overUnder;
    const overML = od.overOdds;
    const underML = od.underOdds;
    if (total != null && overML != null && underML != null) {
      const { fairA: fairOver, fairB: fairUnder } = removeVig({
        impliedA: americanToImplied(overML),
        impliedB: americanToImplied(underML),
      });
      odds.push({ game_id: gameId, home_team: homeTeam, away_team: awayTeam, game_time: gameTime, sport, bet_type: 'totals', outcome: 'over', implied_prob: fairOver, line_value: total, source: 'espn' });
      odds.push({ game_id: gameId, home_team: homeTeam, away_team: awayTeam, game_time: gameTime, sport, bet_type: 'totals', outcome: 'under', implied_prob: fairUnder, line_value: total, source: 'espn' });
    }
  } catch (err: any) {
    console.warn(`[espn] odds fetch failed for ${eventId}:`, err.message);
  }
  return odds;
}

async function fetchSport(sport: typeof SPORTS[0]): Promise<{ games: EspnGame[]; odds: EspnOdds[] }> {
  const games: EspnGame[] = [];
  const allOdds: EspnOdds[] = [];
  try {
    const res = await axios.get(`${BASE}/${sport.path}/scoreboard`, {
      params: { limit: 100, ...(sport.scoreboardParams ?? {}) },
      timeout: 10000,
    });
    const events = res.data?.events ?? [];
    const tasks = events
      .filter((e: any) => e.status?.type?.name !== 'STATUS_FINAL')
      .map(async (event: any) => {
        const comp = event.competitions?.[0];
        if (!comp) return;
        const homeComp = comp.competitors?.find((c: any) => c.homeAway === 'home');
        const awayComp = comp.competitors?.find((c: any) => c.homeAway === 'away');
        if (!homeComp || !awayComp) return;
        const homeTeam = homeComp.team?.displayName ?? homeComp.team?.name ?? 'Home';
        const awayTeam = awayComp.team?.displayName ?? awayComp.team?.name ?? 'Away';
        const gameId = `espn-${event.id}`;
        const gameTime = event.date ?? '';
        const statusType = event.status?.type?.name ?? '';
        games.push({ game_id: gameId, home_team: homeTeam, away_team: awayTeam, game_time: gameTime, status: statusType, sport: sport.key });
        const odds = await fetchOddsForEvent(sport.path, sport.key, event.id, gameId, homeTeam, awayTeam, gameTime);
        allOdds.push(...odds);
      });
    await Promise.all(tasks);
  } catch (err: any) {
    console.warn(`[espn:${sport.key}] fetch failed:`, err.message);
  }
  return { games, odds: allOdds };
}

export async function fetchEspnGames(): Promise<{ games: EspnGame[]; odds: EspnOdds[] }> {
  const results = await Promise.all(SPORTS.map(fetchSport));
  return {
    games: results.flatMap(r => r.games),
    odds:  results.flatMap(r => r.odds),
  };
}
