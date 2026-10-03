# TLE Proxy Strategy

**Status:** Proposed
**Context:** oneSky's `SatelliteService.ts` currently fetches ISS TLEs directly from CelesTrak on-device. That's fine for development; it isn't the shape this should ship in.

## Why direct client-side fetching doesn't hold up in production

**Aggregate demand, not per-user demand, is the real constraint.** CelesTrak's own fair-use guidance boils down to "cache locally, don't hammer us." A single developer testing on one phone respects that trivially. Ten thousand installed copies of oneSky, each independently deciding "my cache is stale, let me fetch," do not — CelesTrak sees the sum of every device's cache-miss decisions, with no way to tell a legitimate spike from abuse. The failure mode isn't a clean error; it's CelesTrak rate-limiting or blocking traffic that looks like a hammering, which degrades or breaks the feature for every user at once, including ones who were fetching responsibly.

**CORS is a real constraint for one of oneSky's targets, not for the other.** `react-native-web` is already a project dependency. On iOS/Android, CORS doesn't apply at all — it's a browser same-origin policy, not a network-layer restriction, so native `fetch` calls are unaffected regardless of what headers CelesTrak sends. But the moment oneSky runs as a web build in an actual browser, CelesTrak's CORS headers stop being an implementation detail and become a hard dependency: if they ever tighten or omit `Access-Control-Allow-Origin`, the web build's TLE fetch breaks outright, with no client-side workaround. That's not a risk worth carrying for a third party that owes oneSky no API contract.

**Credential exposure, for whenever Space-Track is needed.** CelesTrak's public groups cover ISS and Hubble fully today, but if satellite coverage ever expands to Space-Track's fuller catalog, Space-Track requires account credentials. Those credentials cannot live in a distributed APK/IPA — anything shipped to a device is extractable. This was flagged as a deferred decision during Milestone 4's satellite work; this doc is where that decision gets made concrete.

**No shared cache across the fleet.** Each device's local cache only protects that one device from re-fetching too often. It does nothing to bound how often *the app as a whole* hits CelesTrak, which is the number that actually matters for staying inside fair-use limits as the user base grows.

## Proposed architecture: an edge-cached proxy

A small serverless function (Cloudflare Workers or Vercel Edge — either fits; pick whichever the team already deploys elsewhere) sits between the app and CelesTrak:

```
oneSky client  →  edge proxy (own domain)  →  CelesTrak (only on cache miss)
                       ↕
                  KV / edge cache
                  (TLE text + fetched-at timestamp, TTL 1 hour)
```

1. Client requests `GET https://<your-domain>/tle/iss`.
2. The proxy checks its own cache. If an entry exists and is under an hour old, it's returned immediately — no request to CelesTrak at all.
3. On a cache miss (first request of the hour, across *all* users), the proxy fetches CelesTrak once, stores the result with a fresh timestamp, and returns it.
4. Every other user hitting that same hour is served from cache. CelesTrak sees at most one request per hour, total, regardless of whether oneSky has ten users or ten million.

This also resolves the CORS question by construction: the client's only cross-origin hop is to the proxy, whose response headers oneSky controls directly. CelesTrak's own CORS policy — favorable or not, today or in the future — stops being oneSky's problem.

### Response contract

```json
{
  "line1": "1 25544U 98067A   ...",
  "line2": "2 25544  51.6396 ...",
  "fetchedAt": "2026-09-30T04:00:00Z",
  "stale": false
}
```

`stale: true` signals the proxy served a cached entry older than its normal TTL because CelesTrak was unreachable — the client's existing "serve the last-cached TLE, labeled with its age" fallback logic already expects exactly this shape, so no client-side changes are needed to consume it.

### Failure behavior

If CelesTrak is down when the proxy's cache misses, the proxy serves the last successfully-fetched TLE regardless of age (marked `stale: true`) rather than erroring. A multi-day-old TLE with degraded accuracy is a better user experience than no ISS marker at all — the client already tolerates a `null` position gracefully (see `getSatellitePosition`'s propagation-failure handling).

### Where Space-Track fits later

If broader satellite coverage is ever added, Space-Track credentials go in the proxy's environment variables — never the client. The client-facing contract above doesn't change; only what the proxy does internally on a cache miss does.

## What this doc doesn't cover

Provider account setup, infrastructure-as-code, and deployment steps are intentionally out of scope here — this is the case for *why* a proxy, not a runbook for standing one up.