import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LiveTennis, QueryResponseType } from './fetcher';
import type {
  TennisEvent,
  TennisMatch,
  TennisPlayer,
  TennisTeam,
  TennisSetScore,
} from './types';

function log(logs: string[]): void {
  console.log(logs);
}

function makePlayer(id: string): TennisPlayer {
  return {
    id,
    placeholder: false,
    countryCode: 'US',
    country: 'USA',
    firstName: 'John',
    lastName: `Doe-${id}`,
    headUrl: undefined,
    displayName: `John Doe ${id}`,
    slug: id,
    url: '',
  };
}

function makeTeam(playerId: string): TennisTeam {
  return {
    players: [makePlayer(playerId)],
    placeholder: false,
    entryType: 'direct',
    seed: '',
    gameScore: '0',
    setScores: [] as TennisSetScore[],
    displayName: `Team ${playerId}`,
  };
}

function makeMatch(id: string): TennisMatch {
  return {
    id,
    placeholder: false,
    isDoubles: false,
    roundId: 'R1',
    roundName: 'R1',
    courtName: 'Center',
    courtId: 1,
    matchTotalTime: '',
    matchTimeStamp: '',
    matchStateReasonMessage: '',
    message: '',
    status: 'live',
    server: 0,
    winnerId: 0,
    umpireFirstName: '',
    umpireLastName: '',
    lastUpdate: '',
    team1: makeTeam('p1'),
    team2: makeTeam('p2'),
    event: null as any,
    hasFinished: false,
    isLive: true,
    displayName: id,
    displayStatus: '',
    displayScore: '',
    url: '',
    h2hUrl: '',
  };
}

function makeEvent(id: string, matchIds: string[]): TennisEvent {
  const matches = matchIds.map(makeMatch);
  const matchMapping: Record<string, TennisMatch> = {};
  matches.forEach((m) => (matchMapping[m.id] = m));

  const event = {
    id,
    year: 2025,
    name: id,
    title: id,
    countryCode: 'FR',
    country: 'France',
    location: 'Paris',
    city: 'Paris',
    startDate: '2025-05-01',
    endDate: '2025-05-10',
    surface: 'Clay',
    indoor: false,
    type: 'GS',
    displayType: 'Grand Slam',
    isLive: true,
    tour: 'ATP',
    singlesDrawSize: 128,
    doublesDrawSize: 64,
    prizeMoney: 1000000,
    prizeMoneyCurrency: 'EUR',
    displayPrizeMoney: '1M',
    status: 'live',
    matches,
    matchMapping,
    eventTypeUrl: undefined,
    url: '',
    menuUrls: [],
  } as TennisEvent;

  // back-link
  matches.forEach((m) => ((m as any).event = event));
  return event;
}

function createMockFetcher(data?: TennisEvent[] | undefined) {
  return {
    fetchData: vi.fn().mockResolvedValue(data),
    disable: vi.fn(),
  };
}

function createMockSettings(
  enabled: string[] = ['atp', 'atp-challenger', 'wta', 'tennis-temple']
) {
  return {
    getBoolean: vi.fn().mockImplementation(async (k: string) => {
      if (k.startsWith('enable-'))
        return enabled.includes(k.replace('enable-', ''));
      return true;
    }),
    getInt: vi.fn().mockResolvedValue(60),
  };
}

async function drain(
  gen: AsyncGenerator<
    [QueryResponseType, TennisEvent, TennisMatch?],
    [boolean, Map<string, boolean>]
  >
) {
  const yields: [QueryResponseType, TennisEvent, TennisMatch?][] = [];
  let final: [boolean, Map<string, boolean>] = [false, new Map()];
  while (true) {
    const { value, done } = await gen.next();
    if (done) {
      final = value as any;
      break;
    }
    yields.push(value);
  }
  return { yields, final };
}

describe('LiveTennis.query()', () => {
  let atp: ReturnType<typeof createMockFetcher>;
  let wta: ReturnType<typeof createMockFetcher>;
  let tt: ReturnType<typeof createMockFetcher>;

  beforeEach(() => {
    atp = createMockFetcher();
    wta = createMockFetcher();
    tt = createMockFetcher();
  });

  it('AddTournament + AddMatch on first load', async () => {
    const e = makeEvent('roland-garros', ['m1', 'm2']);
    atp.fetchData.mockResolvedValue([e]);
    const settings = createMockSettings(['atp']);

    const live = new LiveTennis(
      log,
      settings as any,
      atp as any,
      wta as any,
      tt as any
    );
    const { yields, final } = await drain(live.query());

    expect(
      yields.filter((y) => y[0] === QueryResponseType.AddTournament)
    ).toHaveLength(1);
    expect(
      yields.filter((y) => y[0] === QueryResponseType.AddMatch)
    ).toHaveLength(2);
    expect(final[0]).toBe(false);
    expect(final[1].get('atp')).toBe(true);
  });

  it('DeleteTournament when event disappears', async () => {
    const settings = createMockSettings(['atp']);
    atp.fetchData.mockResolvedValue([makeEvent('e1', ['m1'])]);
    const live = new LiveTennis(
      log,
      settings as any,
      atp as any,
      wta as any,
      tt as any
    );
    await drain(live.query());

    atp.fetchData.mockResolvedValue([]);
    const { yields } = await drain(live.query());

    expect(yields).toEqual(
      expect.arrayContaining([
        expect.arrayContaining([
          QueryResponseType.DeleteTournament,
          expect.objectContaining({ id: 'e1' }),
        ]),
      ])
    );
  });

  it('DeleteMatch / AddMatch / UpdateMatch / UpdateTournament', async () => {
    const settings = createMockSettings(['wta']);
    wta.fetchData.mockResolvedValue([makeEvent('e1', ['m1', 'm2'])]);
    const live = new LiveTennis(
      log,
      settings as any,
      atp as any,
      wta as any,
      tt as any
    );
    await drain(live.query());

    // m1 deleted, m2 updated, m3 new
    wta.fetchData.mockResolvedValue([makeEvent('e1', ['m2', 'm3'])]);
    const { yields } = await drain(live.query());

    const types = yields.map((y) => y[0]);
    expect(types).toContain(QueryResponseType.DeleteMatch);
    expect(types).toContain(QueryResponseType.AddMatch);
    expect(types).toContain(QueryResponseType.UpdateMatch);
    expect(types).toContain(QueryResponseType.UpdateTournament);

    expect(
      yields.find((y) => y[0] === QueryResponseType.DeleteMatch)?.[2]?.id
    ).toBe('m1');
    expect(
      yields.find((y) => y[0] === QueryResponseType.AddMatch)?.[2]?.id
    ).toBe('m3');
  });

  it('lock / nextTime > 0 yields nothing but marks failed=true', async () => {
    const settings = createMockSettings(['atp']);
    atp.fetchData.mockResolvedValue([makeEvent('e1', ['m1'])]);
    const live = new LiveTennis(
      log,
      settings as any,
      atp as any,
      wta as any,
      tt as any
    );
    await drain(live.query());

    // force the early-return branch: oldEventsMap === newEventsMap
    (live as any)._tourData[0].nextTime = 50;

    const { yields, final } = await drain(live.query());
    expect(yields).toHaveLength(0);
    expect(final[0]).toBe(true); // failed prevents cleanup elsewhere
    expect(final[1].get('atp')).toBe(true);
    expect(atp.fetchData).toHaveBeenCalledTimes(1);
  });

  it('fetcher returns undefined -> status false, failed true', async () => {
    const settings = createMockSettings(['tennis-temple']);
    tt.fetchData.mockResolvedValue(undefined);
    const live = new LiveTennis(
      log,
      settings as any,
      atp as any,
      wta as any,
      tt as any
    );

    const { yields, final } = await drain(live.query());
    expect(yields).toHaveLength(0);
    expect(final).toEqual([true, new Map([['tennis-temple', false]])]);
  });

  it('disabled tours are ignored', async () => {
    const settings = createMockSettings([]);
    const live = new LiveTennis(
      log,
      settings as any,
      atp as any,
      wta as any,
      tt as any
    );
    const { yields, final } = await drain(live.query());
    expect(yields).toHaveLength(0);
    expect(final[0]).toBe(false);
    expect(final[1].size).toBe(0);
  });

  it('concurrent multi-tour handling via Promise.race', async () => {
    const settings = createMockSettings(['atp', 'wta']);
    atp.fetchData.mockResolvedValue([makeEvent('atp-e', ['a1'])]);
    wta.fetchData.mockResolvedValue([makeEvent('wta-e', ['w1'])]);
    const live = new LiveTennis(
      log,
      settings as any,
      atp as any,
      wta as any,
      tt as any
    );

    const { yields, final } = await drain(live.query());
    expect(yields).toHaveLength(4); // 2 tournaments + 2 matches
    expect(final[1].get('atp')).toBe(true);
    expect(final[1].get('wta')).toBe(true);
    expect(final[0]).toBe(false);
  });
});
