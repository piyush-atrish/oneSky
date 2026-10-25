import {
  NETWORK_RETRY_MS,
  SERVER_ERROR_COOLDOWN_MS,
  TLE_FRESH_MS,
  TLE_USABLE_MS,
  TleHttpError,
  createTleLoader,
  type TleStorage,
} from '../src/astro/TleCache';

const L1 = '1 25544U 98067A   26299.50000000  .00010000  00000-0  18000-3 0  9990';
const L2 = '2 25544  51.6400 100.0000 0005000  50.0000 310.0000 15.50000000 10000';

function memoryStorage(initial: string | null = null) {
  let text = initial;
  const storage: TleStorage = {
    read: async () => text,
    write: async (t) => {
      text = t;
    },
  };
  return { storage, get: () => text };
}

function setup(initial: string | null = null, fetcher?: jest.Mock) {
  const mem = memoryStorage(initial);
  let now = 1_000_000_000_000;
  const fetchMock = fetcher ?? jest.fn(async () => [L1, L2] as [string, string]);
  const make = () => createTleLoader({ storage: mem.storage, fetcher: fetchMock, now: () => now });
  return { mem, fetchMock, make, advance: (ms: number) => (now += ms), time: () => now };
}

describe('createTleLoader', () => {
  it('downloads and saves when nothing is cached', async () => {
    const t = setup();
    const result = await t.make().load();
    expect(result.source).toBe('network');
    expect(result.tle).toEqual([L1, L2]);
    expect(t.fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(t.mem.get() as string)).toMatchObject({ line1: L1, line2: L2, fetchedAt: t.time() });
  });

  it('uses a copy younger than 2 hours without any request, even after an app restart', async () => {
    const t = setup();
    await t.make().load();
    t.advance(TLE_FRESH_MS - 1000);
    const restarted = t.make();
    const result = await restarted.load();
    expect(result.source).toBe('cache');
    expect(t.fetchMock).toHaveBeenCalledTimes(1);
  });

  it('downloads again once the copy is 2 hours old', async () => {
    const t = setup();
    await t.make().load();
    t.advance(TLE_FRESH_MS);
    const result = await t.make().load();
    expect(result.source).toBe('network');
    expect(t.fetchMock).toHaveBeenCalledTimes(2);
  });

  it('stops querying after a non-200 reply, for the whole cooldown and across restarts', async () => {
    const fetcher = jest.fn(async (): Promise<[string, string]> => {
      throw new TleHttpError(503);
    });
    const t = setup(null, fetcher);
    expect((await t.make().load()).source).toBe('none');
    expect(fetcher).toHaveBeenCalledTimes(1);

    t.advance(SERVER_ERROR_COOLDOWN_MS - 1000);
    await t.make().load(); // new loader = app restart
    await t.make().load();
    expect(fetcher).toHaveBeenCalledTimes(1);

    t.advance(2000);
    await t.make().load();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('keeps showing the saved copy when the server refuses a refresh', async () => {
    const good = setup();
    await good.make().load();
    const failing = jest.fn(async (): Promise<[string, string]> => {
      throw new TleHttpError(403);
    });
    const t = setup(good.mem.get());
    // reuse the saved record with a failing fetcher, 3 hours later
    const loader = createTleLoader({
      storage: t.mem.storage,
      fetcher: failing,
      now: () => good.time() + 3 * 60 * 60 * 1000,
    });
    const result = await loader.load();
    expect(result.source).toBe('cache');
    expect(result.tle).toEqual([L1, L2]);
    expect(JSON.parse(t.mem.get() as string).blockedUntil).toBeGreaterThan(good.time());
  });

  it('waits a minute after a network failure (device offline) before trying again', async () => {
    const fetcher = jest.fn(async (): Promise<[string, string]> => {
      throw new TypeError('Network request failed');
    });
    const t = setup(null, fetcher);
    const loader = t.make();
    expect((await loader.load()).source).toBe('none');
    t.advance(NETWORK_RETRY_MS - 1000);
    await loader.load();
    expect(fetcher).toHaveBeenCalledTimes(1);
    t.advance(2000);
    await loader.load();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('ignores a saved copy older than 7 days', async () => {
    const t = setup();
    await t.make().load();
    const saved = t.mem.get();
    const offline = jest.fn(async (): Promise<[string, string]> => {
      throw new TypeError('Network request failed');
    });
    const loader = createTleLoader({
      storage: memoryStorage(saved).storage,
      fetcher: offline,
      now: () => t.time() + TLE_USABLE_MS + 1000,
    });
    const result = await loader.load();
    expect(result.tle).toBeNull();
    expect(result.source).toBe('none');
  });

  it('ignores corrupt saved data', async () => {
    const t = setup('{not json');
    const result = await t.make().load();
    expect(result.source).toBe('network');
  });

  it('shares one download between simultaneous callers', async () => {
    const t = setup();
    const loader = t.make();
    const [a, b, c] = await Promise.all([loader.load(), loader.load(), loader.load()]);
    expect(t.fetchMock).toHaveBeenCalledTimes(1);
    expect(a).toEqual(b);
    expect(b).toEqual(c);
  });

  it('still returns fresh data if saving fails', async () => {
    const storage: TleStorage = {
      read: async () => null,
      write: async () => {
        throw new Error('disk full');
      },
    };
    const loader = createTleLoader({ storage, fetcher: async () => [L1, L2], now: () => 5 });
    const result = await loader.load();
    expect(result.source).toBe('network');
    expect(result.tle).toEqual([L1, L2]);
  });
});
