import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MockInstance } from 'vitest';

// 1. hoisted ref - DO NOT destructure
const mockLiveTennisRef = vi.hoisted(() => {
  return { current: null as any };
});

vi.mock('./atp_fetcher', () => ({ AtpFetcher: function () {} }));
vi.mock('./wta_fetcher', () => ({ WtaFetcher: function () {} }));
vi.mock('./tt_fetcher', () => ({ TTFetcher: function () {} }));
vi.mock('./fetcher', async () => {
  const actual = await vi.importActual<typeof import('./fetcher')>('./fetcher');
  function MockLiveTennis(this: any) {
    return mockLiveTennisRef.current ?? this;
  }
  return {
    ...actual,
    LiveTennis: MockLiveTennis as any,
    QueryResponseType: actual.QueryResponseType,
  };
});

import { LiveViewUpdater } from './live_view_updater';
import { QueryResponseType } from './fetcher';
import type { TennisEvent, TennisMatch } from './types';
import type { Runner } from './runner';
import type { Settings } from './settings';
import type { LiveViewManager } from './live_view_updater';
import { ApiHandler } from './api';

function makeEvent(id: string, title = id): TennisEvent {
  return { id, title } as unknown as TennisEvent;
}
function makeMatch(id: string, eventId: string, isLive = true): TennisMatch {
  const event = { id: eventId, title: eventId } as any;
  return {
    id,
    isLive,
    event,
    team1: { players: [] },
    team2: { players: [] },
  } as unknown as TennisMatch;
}

function mockQuery(
  yields: [QueryResponseType, TennisEvent, TennisMatch?][],
  finalReturn: [boolean, Map<string, boolean>] = [true, new Map()]
) {
  return vi.fn().mockImplementation(() => {
    async function* gen() {
      for (const y of yields) yield y as any;
      return finalReturn as any;
    }
    return gen();
  });
}

function log(logs: string[]): void {
  console.log(logs);
}

describe('LiveViewUpdater', () => {
  // use any for runner/manager to avoid Mock generic pain, it's just test doubles
  let runner: any;
  let manager: any;
  let settings: any;
  let mockLiveTennis: any;
  let FakeTT: any;

  beforeEach(() => {
    runner = {
      addEvent: vi.fn().mockResolvedValue(undefined),
      removeEvent: vi.fn().mockResolvedValue(undefined),
      addMatch: vi.fn().mockResolvedValue(undefined),
      updateMatch: vi.fn().mockResolvedValue(undefined),
      removeMatch: vi.fn().mockResolvedValue(undefined),
      uniqMatchId: vi
        .fn()
        .mockImplementation(
          (e: TennisEvent, m: TennisMatch) => `${e.id}::${m.id}`
        ),
      isMatchWaitingDeselection: vi.fn().mockReturnValue(false),
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
      getBoolean: vi.fn().mockImplementation(async (k: string) => {
        if (k === 'enabled') return true;
        if (k === 'only-show-live-matches') return false;
        if (k === 'auto-hide-no-live-matches') return false;
        return true;
      }),
      getInt: vi.fn().mockImplementation(async (k: string) => {
        if (k === 'num-windows') return 2;
        if (k === 'match-display-duration') return 5;
        return 60;
      }),
      getStrv: vi.fn().mockResolvedValue(['e1::m1', 'e1::m2']),
    };

    mockLiveTennis = {
      disable: vi.fn(),
      resetNextRunTimes: vi.fn(),
      query: mockQuery([]),
      updateNextRunTimesAndGetInterval: vi.fn().mockResolvedValue(30),
    };
    mockLiveTennisRef.current = mockLiveTennis;

    FakeTT = class {
      constructor(_api: ApiHandler, _log: any) {}
    };
  });

  function createUpdater() {
    const api = {} as ApiHandler;
    return new LiveViewUpdater(
      runner as Runner,
      manager as LiveViewManager,
      api,
      settings as Settings,
      log as unknown as (logs: string[]) => void,
      FakeTT
    );
  }

  it('_cycleMatches rotates index and calls continue', async () => {
    settings.getStrv.mockResolvedValue(['e1::m1', 'e1::m2', 'e1::m3']);
    const u = createUpdater();
    const matches = [
      makeMatch('m1', 'e1'),
      makeMatch('m2', 'e1'),
      makeMatch('m3', 'e1'),
    ];
    (u as any)._getSelectedMatches = vi.fn().mockResolvedValue(matches);
    (u as any)._shouldHideLiveView = vi.fn().mockResolvedValue(false);
    manager.getLiveViewCount.mockReturnValue(1);

    await (u as any)._cycleMatches(matches);

    expect(manager.updateLiveViewContent).toHaveBeenCalled();
    expect(manager.setCycleTimeout).toHaveBeenCalledWith(
      5,
      expect.any(Function)
    );
    expect((u as any)._currentMatchIndex).toBe(1);
  });
});
