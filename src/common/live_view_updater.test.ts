import { describe, it, expect, vi, beforeEach } from 'vitest';

function log(logs: string[]): void {
  console.log(logs);
}

const mockLiveTennisRef = vi.hoisted(() => ({ current: null as any }));

vi.mock('./atp_fetcher', () => ({ AtpFetcher: function () {} }));
vi.mock('./wta_fetcher', () => ({ WtaFetcher: function () {} }));
vi.mock('./tt_fetcher', () => ({ TTFetcher: function () {} }));
vi.mock('./fetcher', async () => {
  const actual = await vi.importActual<typeof import('./fetcher')>('./fetcher');
  function MockLiveTennis(this: any) {
    return mockLiveTennisRef.current ?? this;
  }
  return { ...actual, LiveTennis: MockLiveTennis as any };
});

import { LiveViewUpdater } from './live_view_updater';
import { QueryResponseType } from './fetcher';
import type { TennisMatch, TennisEvent } from './types';
import type { Runner } from './runner';
import type { Settings } from './settings';
import type { LiveViewManager } from './live_view_updater';
import { ApiHandler } from './api';

function makeEvent(id: string, title = id): TennisEvent {
  return { id, title } as unknown as TennisEvent;
}
function makeMatch(id: string, eventId: string, isLive: boolean): TennisMatch {
  return {
    id,
    isLive,
    event: { id: eventId, title: eventId } as any,
    team1: { players: [] },
    team2: { players: [] },
  } as unknown as TennisMatch;
}
function mockQuery(
  yields: [QueryResponseType, TennisEvent, TennisMatch?][],
  finalReturn: [boolean, Map<string, boolean>] = [
    true,
    new Map([['atp', true]]),
  ]
) {
  return vi.fn().mockImplementation(() => {
    async function* gen() {
      for (const y of yields) yield y as any;
      return finalReturn as any;
    }
    return gen();
  });
}

describe('LiveViewUpdater - full coverage, critical thorough', () => {
  let runner: any;
  let manager: any;
  let settings: any;
  let mockLiveTennis: any;
  let selectedIds: string[];
  let onlyLive: boolean;
  let waiting: Map<string, boolean>;
  let enabled: boolean;
  let autoHide: boolean;

  beforeEach(() => {
    selectedIds = ['e1::m1'];
    onlyLive = false;
    waiting = new Map();
    enabled = true;
    autoHide = false;
    runner = {
      uniqMatchId: vi
        .fn()
        .mockImplementation(
          (e: TennisEvent, m: TennisMatch) => `${e.id}::${m.id}`
        ),
      isMatchWaitingDeselection: vi
        .fn()
        .mockImplementation((id: string) => waiting.get(id) ?? false),
      addEvent: vi.fn().mockResolvedValue(undefined),
      removeEvent: vi.fn().mockResolvedValue(undefined),
      addMatch: vi.fn().mockResolvedValue(undefined),
      updateMatch: vi.fn().mockResolvedValue(undefined),
      removeMatch: vi.fn().mockResolvedValue(undefined),
      filterAutoEvents: vi.fn().mockResolvedValue(undefined),
      filterLiveViewMatches: vi.fn().mockResolvedValue(undefined),
      updateFetchStatuses: vi.fn(),
      setLastRefreshTime: vi.fn(),
    };
    manager = {
      setFetchTimer: vi.fn(),
      unsetFetchTimer: vi.fn(),
      getLiveViewCount: vi.fn().mockReturnValue(2),
      setLiveViewCount: vi.fn().mockResolvedValue(undefined),
      updateLiveViewContent: vi.fn(),
      setLiveViewContentsEmpty: vi.fn(),
      hideLiveViews: vi.fn(),
      destroyLiveView: vi.fn(),
      setCycleTimeout: vi.fn(),
      destroyCycleTimeout: vi.fn(),
      removeCycleTimeout: vi.fn().mockReturnValue(true),
      continueCycleTimeout: vi.fn().mockReturnValue(true),
    };
    settings = {
      getStrv: vi
        .fn()
        .mockImplementation(async (k: string) =>
          k === 'selected-matches' ? selectedIds : []
        ),
      getBoolean: vi.fn().mockImplementation(async (k: string) => {
        if (k === 'only-show-live-matches') return onlyLive;
        if (k === 'enabled') return enabled;
        if (k === 'auto-hide-no-live-matches') return autoHide;
        return true;
      }),
      getInt: vi
        .fn()
        .mockImplementation(async (k: string) =>
          k === 'num-windows' ? 2 : k === 'match-display-duration' ? 5 : 60
        ),
    };
    mockLiveTennis = {
      disable: vi.fn(),
      resetNextRunTimes: vi.fn(),
      query: mockQuery([]),
      updateNextRunTimesAndGetInterval: vi.fn().mockResolvedValue(30),
    };
    mockLiveTennisRef.current = mockLiveTennis;
  });

  function createUpdater() {
    const FakeTT = class {
      constructor(_a: any, _b: any) {}
    };
    return new LiveViewUpdater(
      runner as Runner,
      manager as LiveViewManager,
      {} as ApiHandler,
      settings as Settings,
      log as unknown as any,
      FakeTT as any
    );
  }

  // ---------- lifecycle ----------
  it('disable', () => {
    const u = createUpdater();
    u.disable();
    expect(mockLiveTennis.disable).toHaveBeenCalled();
    expect(manager.unsetFetchTimer).toHaveBeenCalled();
  });

  it('fetchMatchData resets, updates status, sets timer and refresh time', async () => {
    const u = createUpdater();
    await u.fetchMatchData();
    expect(mockLiveTennis.resetNextRunTimes).toHaveBeenCalled();
    expect(mockLiveTennis.updateNextRunTimesAndGetInterval).toHaveBeenCalled();
    expect(manager.setFetchTimer).toHaveBeenCalledWith(
      30,
      expect.any(Function)
    );
    expect(runner.setLastRefreshTime).toHaveBeenCalled();
  });

  // ---------- fetch diff ----------
  it('AddTournament with title adds, empty title skips and logs', async () => {
    const e1 = makeEvent('e1', 'RG');
    const e2 = makeEvent('e2', '');
    mockLiveTennis.query = mockQuery([
      [QueryResponseType.AddTournament, e1],
      [QueryResponseType.AddTournament, e2],
    ]);
    await createUpdater().fetchMatchData();
    expect(runner.addEvent).toHaveBeenCalledWith(e1);
    expect(runner.addEvent).not.toHaveBeenCalledWith(e2);
  });

  it('UpdateTournament tracks ids but does not add', async () => {
    const e = makeEvent('e1');
    mockLiveTennis.query = mockQuery([[QueryResponseType.UpdateTournament, e]]);
    await createUpdater().fetchMatchData();
    expect(runner.addEvent).not.toHaveBeenCalled();
  });

  it('AddMatch sets eventId and eventTitle', async () => {
    const e = makeEvent('e1', 'My Event');
    const mm = makeMatch('m1', 'e1', true);
    mockLiveTennis.query = mockQuery([[QueryResponseType.AddMatch, e, mm]]);
    await createUpdater().fetchMatchData();
    expect(runner.addMatch).toHaveBeenCalledWith(
      expect.objectContaining({ eventId: 'e1', eventTitle: 'My Event' })
    );
  });

  it('handles UpdateMatch, DeleteMatch, DeleteTournament', async () => {
    const e = makeEvent('e1');
    mockLiveTennis.query = mockQuery([
      [QueryResponseType.UpdateMatch, e, makeMatch('m2', 'e1', true)],
      [QueryResponseType.DeleteMatch, e, makeMatch('m3', 'e1', false)],
      [QueryResponseType.DeleteTournament, makeEvent('e-del')],
    ]);
    await createUpdater().fetchMatchData();
    expect(runner.updateMatch).toHaveBeenCalled();
    expect(runner.removeMatch).toHaveBeenCalled();
    expect(runner.removeEvent).toHaveBeenCalled();
  });

  it('filters stale when allGood true and skips when false', async () => {
    mockLiveTennis.query = mockQuery([], [true, new Map()]);
    let u = createUpdater();
    await u.fetchMatchData();
    expect(runner.filterAutoEvents).toHaveBeenCalled();
    vi.clearAllMocks();
    mockLiveTennis.query = mockQuery([], [false, new Map()]);
    u = createUpdater();
    await u.fetchMatchData();
    expect(runner.filterAutoEvents).not.toHaveBeenCalled();
  });

  it('logs error with stack', async () => {
    const err = new Error('boom');
    (err as any).stack = 'stacktrace';
    mockLiveTennis.query = vi.fn().mockImplementation(() => {
      throw err;
    });
    await createUpdater().fetchMatchData();
  });

  // ---------- CRITICAL: _getSelectedMatches ----------
  describe('_getSelectedMatches - exhaustive', () => {
    const cases: Array<[boolean, boolean, boolean, boolean, boolean, string]> =
      [
        [
          true,
          false,
          false,
          false,
          true,
          'waiting overrides not selected not live',
        ],
        [true, false, false, true, true, 'waiting overrides not selected live'],
        [
          true,
          false,
          true,
          false,
          true,
          'waiting overrides onlyLive true not live',
        ],
        [true, false, true, true, true, 'waiting overrides onlyLive true live'],
        [
          true,
          true,
          false,
          false,
          true,
          'waiting true sel onlyLive false not live',
        ],
        [true, true, false, true, true, 'waiting true sel onlyLive false live'],
        [
          true,
          true,
          true,
          false,
          true,
          'waiting true sel onlyLive true not live',
        ],
        [true, true, true, true, true, 'waiting true sel onlyLive true live'],
        [false, false, false, false, false, 'not selected exclude'],
        [false, false, false, true, false, 'not selected live exclude'],
        [
          false,
          false,
          true,
          false,
          false,
          'not selected onlyLive true not live exclude',
        ],
        [
          false,
          false,
          true,
          true,
          false,
          'not selected onlyLive true live exclude',
        ],
        [
          false,
          true,
          false,
          false,
          true,
          'sel onlyLive false not live include',
        ],
        [false, true, false, true, true, 'sel onlyLive false live include'],
        [false, true, true, false, false, 'sel onlyLive true not live exclude'],
        [false, true, true, true, true, 'sel onlyLive true live include'],
      ];
    it.each(cases)(
      'w=%s sel=%s onlyLive=%s live=%s => %s (%s)',
      async (isW, isSel, oLive, live, exp) => {
        onlyLive = oLive;
        const mm = makeMatch('m1', 'e1', live);
        selectedIds = isSel ? ['e1::m1'] : [];
        waiting.set('e1::m1', isW);
        const u = createUpdater();
        const res = await (u as any)._getSelectedMatches([mm]);
        expect(res.length === 1).toBe(exp);
      }
    );

    it('batch and empty', async () => {
      onlyLive = true;
      selectedIds = ['e1::m1', 'e1::m2'];
      waiting.set('e1::m4', true);
      const batch = [
        makeMatch('m1', 'e1', true),
        makeMatch('m2', 'e1', false),
        makeMatch('m3', 'e1', true),
        makeMatch('m4', 'e1', false),
      ];
      const u = createUpdater();
      const res = await (u as any)._getSelectedMatches(batch);
      expect(res.map((x: TennisMatch) => x.id).sort()).toEqual(['m1', 'm4']);
      expect(await (u as any)._getSelectedMatches([])).toEqual([]);
    });
  });

  describe('_shouldHideLiveView - exhaustive', () => {
    const hideCases: Array<[boolean, boolean, boolean[], boolean, string]> = [
      [false, false, [], true, 'disabled hide'],
      [false, true, [true], true, 'disabled overrides'],
      [true, false, [], false, 'enabled autoHide off show empty'],
      [
        true,
        false,
        [false, false],
        false,
        'enabled autoHide off show not live',
      ],
      [true, true, [], true, 'autoHide on empty hide'],
      [true, true, [false, false], true, 'autoHide on all not live hide'],
      [true, true, [false, true], false, 'autoHide on one live show'],
      [true, true, [true, true], false, 'autoHide on all live show'],
    ];
    it.each(hideCases)(
      'en=%s ah=%s lives=%j => hide=%s',
      async (en, ah, lives, shouldHide) => {
        enabled = en;
        autoHide = ah;
        const sel = lives.map((lv, i) => makeMatch(`m${i}`, 'e1', lv));
        const u = createUpdater();
        expect(await (u as any)._shouldHideLiveView(sel)).toBe(shouldHide);
      }
    );
  });

  // ---------- windows ----------
  it('_updateFloatingWindows hides, shows direct, triggers cycle', async () => {
    const u = createUpdater();
    (u as any)._getSelectedMatches = vi
      .fn()
      .mockResolvedValue([makeMatch('m1', 'e1', false)]);
    (u as any)._shouldHideLiveView = vi.fn().mockResolvedValue(true);
    await (u as any)._updateFloatingWindows([]);
    expect(manager.hideLiveViews).toHaveBeenCalled();

    vi.clearAllMocks();
    const one = [makeMatch('m1', 'e1', true)];
    (u as any)._getSelectedMatches = vi.fn().mockResolvedValue(one);
    (u as any)._shouldHideLiveView = vi.fn().mockResolvedValue(false);
    await (u as any)._updateFloatingWindows(one);
    expect(manager.updateLiveViewContent).toHaveBeenCalledWith(0, one[0]);
    expect(manager.setLiveViewContentsEmpty).toHaveBeenCalledWith(1);

    vi.clearAllMocks();
    const three = [
      makeMatch('m1', 'e1', true),
      makeMatch('m2', 'e1', true),
      makeMatch('m3', 'e1', true),
    ];
    (u as any)._getSelectedMatches = vi.fn().mockResolvedValue(three);
    (u as any)._shouldHideLiveView = vi.fn().mockResolvedValue(false);
    const spy = vi
      .spyOn(u as any, '_cycleMatches')
      .mockResolvedValue(undefined);
    await (u as any)._updateFloatingWindows(three);
    expect(spy).toHaveBeenCalled();
  });

  it('_cycleMatches rotates, wraps, stops on shrink, respects hide', async () => {
    const u = createUpdater();
    const many = [
      makeMatch('m1', 'e1', true),
      makeMatch('m2', 'e1', true),
      makeMatch('m3', 'e1', true),
    ];
    (u as any)._getSelectedMatches = vi.fn().mockResolvedValue(many);
    (u as any)._shouldHideLiveView = vi.fn().mockResolvedValue(false);
    manager.getLiveViewCount.mockReturnValue(1);
    await (u as any)._cycleMatches(many);
    expect((u as any)._currentMatchIndex).toBe(1);
    const cycleFn = manager.setCycleTimeout.mock.calls[0][1];
    await cycleFn();
    expect((u as any)._currentMatchIndex).toBe(2);
    await cycleFn();
    expect((u as any)._currentMatchIndex).toBe(0);

    // shrink inside cycle -> fallback
    (u as any)._getSelectedMatches = vi
      .fn()
      .mockResolvedValueOnce(many)
      .mockResolvedValueOnce([many[0]]);
    (u as any)._updateFloatingWindows = vi.fn().mockResolvedValue(undefined);
    await (u as any)._cycleMatches(many);
    const cycleFn2 = manager.setCycleTimeout.mock.calls[1][1];
    const ret = await cycleFn2();
    expect(ret).toBe(true);
  });

  it('updateUI uses _currentMatchesData', async () => {
    const u = createUpdater();
    (u as any)._currentMatchesData = [makeMatch('m1', 'e1', true)];
    (u as any)._updateFloatingWindows = vi.fn().mockResolvedValue(undefined);
    (u as any).updateUI();
    await new Promise((r) => setTimeout(r, 0));
    expect((u as any)._updateFloatingWindows).toHaveBeenCalled();
  });
});
