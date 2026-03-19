import { describe, it, expect } from 'vitest';
import { resolveTeam } from '../../src/math/teams.js';

describe('resolveTeam', () => {
  it('resolves short name: "Duke" -> "duke-blue-devils"', () => {
    expect(resolveTeam('Duke')).toBe('duke-blue-devils');
  });

  it('resolves full name: "Duke Blue Devils" -> "duke-blue-devils"', () => {
    expect(resolveTeam('Duke Blue Devils')).toBe('duke-blue-devils');
  });

  it('resolves all-caps: "DUKE" -> "duke-blue-devils"', () => {
    expect(resolveTeam('DUKE')).toBe('duke-blue-devils');
  });

  it('resolves common abbreviation: "Kansas" -> "kansas-jayhawks"', () => {
    expect(resolveTeam('Kansas')).toBe('kansas-jayhawks');
  });

  it('resolves full name: "Kansas Jayhawks" -> "kansas-jayhawks"', () => {
    expect(resolveTeam('Kansas Jayhawks')).toBe('kansas-jayhawks');
  });

  it('resolves nickname form: "UConn" -> "connecticut-huskies"', () => {
    expect(resolveTeam('UConn')).toBe('connecticut-huskies');
  });

  it('resolves state name: "Connecticut" -> "connecticut-huskies"', () => {
    expect(resolveTeam('Connecticut')).toBe('connecticut-huskies');
  });

  it('returns null for unknown team', () => {
    expect(resolveTeam('UnknownTeamXYZ')).toBeNull();
  });

  it('does not throw on unknown team', () => {
    expect(() => resolveTeam('UnknownTeamXYZ')).not.toThrow();
  });
});
