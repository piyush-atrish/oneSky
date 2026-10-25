/**
 * Cache and back-off policy for the ISS orbit data (a two-line element set, "TLE").
 *
 * Follows CelesTrak's usage policy (https://celestrak.org/usage-policy.php):
 *  - GP data changes about every 2 hours, so it is downloaded at most once per update;
 *  - software must stop querying after any non-200 reply, so a rejected request blocks further requests for a
 *    full update cycle (and that block survives an app restart, because it is saved with the cached data).
 *
 * This module has no React Native or Expo imports so it can be tested on its own.
 */

/** CelesTrak refreshes GP data every 2 hours: a copy younger than this is used without any request. */
export const TLE_FRESH_MS = 2 * 60 * 60 * 1000;
/** Older than this the ISS position drifts too far to show, so the cached copy is ignored. */
export const TLE_USABLE_MS = 7 * 24 * 60 * 60 * 1000;
/** After a rejected request (any non-200 reply) no new request is made for a full update cycle. */
export const SERVER_ERROR_COOLDOWN_MS = 2 * 60 * 60 * 1000;
/** After a failure that never reached the server (device offline) wait at least this long before trying again. */
export const NETWORK_RETRY_MS = 60 * 1000;

/** Thrown by the downloader when the server answers with anything other than HTTP 200. */
export class TleHttpError extends Error {
  readonly status: number;
  constructor(status: number, message?: string) {
    super(message ?? `TLE server answered HTTP ${status}`);
    this.name = 'TleHttpError';
    this.status = status;
  }
}

export interface TleRecord {
  readonly line1?: string;
  readonly line2?: string;
  /** When the lines were downloaded (ms since epoch). */
  readonly fetchedAt?: number;
  /** No request may be made before this time (ms since epoch). */
  readonly blockedUntil?: number;
}

export interface TleStorage {
  read(): Promise<string | null>;
  write(text: string): Promise<void>;
}

export interface TleResult {
  readonly tle: [string, string] | null;
  readonly fetchedAt: number | null;
  readonly source: 'cache' | 'network' | 'none';
}

export interface TleLoaderDeps {
  readonly storage: TleStorage;
  readonly fetcher: () => Promise<[string, string]>;
  readonly now: () => number;
}

function parseRecord(text: string | null): TleRecord {
  if (!text) return {};
  try {
    const raw: unknown = JSON.parse(text);
    if (typeof raw !== 'object' || raw === null) return {};
    const r = raw as Record<string, unknown>;
    const line1 = typeof r.line1 === 'string' ? r.line1 : undefined;
    const line2 = typeof r.line2 === 'string' ? r.line2 : undefined;
    const fetchedAt = typeof r.fetchedAt === 'number' && Number.isFinite(r.fetchedAt) ? r.fetchedAt : undefined;
    const blockedUntil = typeof r.blockedUntil === 'number' && Number.isFinite(r.blockedUntil) ? r.blockedUntil : undefined;
    return line1 && line2 && fetchedAt !== undefined ? { line1, line2, fetchedAt, blockedUntil } : { blockedUntil };
  } catch {
    return {};
  }
}

/** Creates a loader. Keep ONE instance for the whole app: it also de-duplicates simultaneous calls. */
export function createTleLoader(deps: TleLoaderDeps) {
  let lastNetworkFailure = Number.NEGATIVE_INFINITY;
  let inFlight: Promise<TleResult> | null = null;

  const usable = (record: TleRecord, now: number): TleResult => {
    if (record.line1 && record.line2 && record.fetchedAt !== undefined && now - record.fetchedAt <= TLE_USABLE_MS) {
      return { tle: [record.line1, record.line2], fetchedAt: record.fetchedAt, source: 'cache' };
    }
    return { tle: null, fetchedAt: null, source: 'none' };
  };

  const run = async (): Promise<TleResult> => {
    const now = deps.now();
    let record: TleRecord = {};
    try {
      record = parseRecord(await deps.storage.read());
    } catch {
      record = {};
    }

    const cached = usable(record, now);
    if (cached.tle && record.fetchedAt !== undefined && now - record.fetchedAt < TLE_FRESH_MS) return cached;
    if (record.blockedUntil !== undefined && now < record.blockedUntil) return cached;
    if (now - lastNetworkFailure < NETWORK_RETRY_MS) return cached;

    try {
      const [line1, line2] = await deps.fetcher();
      const saved: TleRecord = { line1, line2, fetchedAt: now };
      try {
        await deps.storage.write(JSON.stringify(saved));
      } catch {
        // Saving is best-effort: the fresh data is still used for this session.
      }
      return { tle: [line1, line2], fetchedAt: now, source: 'network' };
    } catch (error) {
      if (error instanceof TleHttpError) {
        // The server answered but refused or failed: stop for a full update cycle, even across restarts.
        const blocked: TleRecord = { ...record, blockedUntil: now + SERVER_ERROR_COOLDOWN_MS };
        try {
          await deps.storage.write(JSON.stringify(blocked));
        } catch {
          lastNetworkFailure = now;
        }
      } else {
        lastNetworkFailure = now;
      }
      return cached;
    }
  };

  return {
    load(): Promise<TleResult> {
      if (!inFlight) {
        inFlight = run().finally(() => {
          inFlight = null;
        });
      }
      return inFlight;
    },
  };
}
