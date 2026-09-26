# oneSky Project Roadmap

Here's the revised plan with each fix folded directly into the milestone it affects, laid out as an execution table you can work through top to bottom. I've kept the four Version-1 milestones but changed the *how* on the two risky items (M4's per-frame ephemeris, M6's raycaster), tightened M3's data-sourcing language, and added M5's fallback path. I've also added Milestone 7, which didn't exist in the original plan at all — it's everything that actually gates a Play Store listing.

## Milestone 3 — Catalog & Constellations

| # | Task | What changed vs. original plan | Definition of done |
| :--- | :--- | :--- | :--- |
| 1 | Pull HYG database CSV, confirm column schema (ra/dec/mag/ci, HR/HD/Hip IDs) | — | Raw CSV parseable, columns identified |
| 2 | Node script: filter mag ≤ 6.5, map to `[raHours, decDeg, mag, bv]`, dedupe multi-component systems | — | Output array length ≈ 9,110 ± a few hundred |
| 3 | Generate a static `starCatalog.ts` module (same pattern as today's 10-star file), not a runtime-parsed JSON asset | Keeps zero-parse-cost at app start | Import compiles, array populates `StarsLayer`'s existing `useMemo` unchanged |
| 4 | Source constellation line data from Stellarium's western-skyculture set or the D3-celestial project | Fix: stop calling this "IAU asterisms" — IAU defines only the 88 boundary regions, never official connect-the-dot lines. Use "traditional/western constellation lines" in code and UI copy | Dataset chosen, license terms read and recorded |
| 5 | Cross-reference each line's star IDs against your HYG catalog IDs (HR/HD/Hip) | — | Every line endpoint resolves to a real catalog index, zero dangling refs |
| 6 | Build `ConstellationsLayer.tsx`: one `THREE.LineSegments` buffer from resolved star positions, built once via `useMemo` | — | Renders as a toggleable sibling layer, same draw-order slot as `StarsLayer` |
| 7 | Add show/hide toggle to a lightweight UI-state slice | — | Toggling doesn't cause a full re-render of `StarsLayer` |
| 8 | Add a Credits/About entry attributing HYG (Astronexus) and the constellation-line source | New — licensing hygiene for a proprietary app built on open data | Screen exists, sources listed |
| 9 | Unit test: catalog length in expected range, no NaN/out-of-range RA-Dec, every constellation line resolves | New | Test suite green |
| 10 | Device test: confirm FPS holds with full 9,110-star + line-buffer scene on a mid-range Android phone | New | 60fps sustained, no GC stutter |

## Milestone 4 — Dynamic Orbits & Satellites

| # | Task | What changed vs. original plan | Definition of done |
| :--- | :--- | :--- | :--- |
| 1 | Install `astronomy-engine` (MIT-licensed, VSOP87-based) | — | Package installed, importable |
| 2 | Build `src/astro/EphemerisService.ts`: pure functions returning geocentric RA/Dec for Sun, Moon, Mercury–Neptune given a Date | — | Functions return sane values for a known test date |
| 3 | Build `useCelestialStore` (Zustand): holds latest computed positions + last-compute timestamp | — | Store initializes with a first compute on app start |
| 4 | Build a throttled updater — interval-based (e.g. every 5–10s) or an elapsed-time gate, writing into `useCelestialStore` | Fix (was the biggest risk): original plan computed ephemeris inside `useFrame` every tick — wasteful, battery-costly, no visible benefit since bodies barely move frame to frame | Position updates land on the store without any per-frame astronomy math |
| 5 | Build `SolarSystemLayer.tsx`: reads the store, renders bodies reusing `StarsLayer`'s shader pipeline with per-type sizing/coloring | — | Sun/Moon/planets render at correct positions |
| 6 | Add a lunar-phase sub-shader driven by `astronomy-engine`'s phase-angle output as a uniform | — | Terminator line visually correct for current date |
| 7 | TLE fetch module: CelesTrak only, no Space-Track credentials in the client | Fix: embedding Space-Track credentials in a distributed APK is extractable; also Space-Track's own guidance caps automated queries around once/hour, which a shared client would blow through | Fetch works against CelesTrak's public GP endpoint |
| 8 | Cache TLE text + fetch timestamp (`AsyncStorage`/`expo-file-system`); treat as stale after ~3 days; refetch only when stale and online; otherwise serve cached copy labeled with its age | Fix: no caching/staleness policy existed in original plan | Offline app still shows a satellite position, correctly labeled as possibly stale |
| 9 | Integrate `satellite.js` SGP4 propagation on the cached TLE, computed on the same throttle cadence as planets (satellites move fast on-screen, but propagation math itself doesn't need 60Hz) | — | ISS/Hubble positions update smoothly, no visible "jump" artifacts |
| 10 | Document (don't build yet): if Space-Track's broader catalog is ever needed, it goes through a backend proxy holding credentials server-side | New | Decision recorded so it isn't reopened later |
| 11 | Unit test: ephemeris output checked against a known reference date/event as a regression guard | New | Test suite green |
| 12 | Device test: confirm no visible position "pop" between throttled updates; add interpolation if needed | New | Motion reads as smooth, not steppy |

## Milestone 5 — GPS & the Local Horizon

| # | Task | What changed vs. original plan | Definition of done |
| :--- | :--- | :--- | :--- |
| 1 | Install `expo-location`, add manifest/plist permission entries | — | Permission prompt appears correctly |
| 2 | Build `LocationProvider`: one-time foreground fetch (`getCurrentPositionAsync`), not continuous `watchPosition`, not background permission | Fix: continuous/background location is unnecessary battery cost and pulls you into Play Console's stricter background-location review — a stargazing app only needs a fix at launch/refresh | Location resolves once per session/manual refresh |
| 3 | Add manual location entry (city or lat/long) plus last-known-location caching for permission-denied or no-GPS-fix cases (common indoors) | Fix: original plan had no fallback — a denied permission would leave the app non-functional | App remains usable with degraded (manual/cached) location |
| 4 | Build `src/astro/SiderealTime.ts`: pure function computing Julian Date + Local Sidereal Time from device time + longitude | — | Matches a known reference LST value in a unit test |
| 5 | Build `useObserverStore`: lat/long + current LST, recomputed on a throttle (e.g. every 10–30s) | Fix: same anti-pattern as M4 — LST shifts ~15°/hour, so the calculation doesn't need per-frame recompute, only the resulting rotation needs per-frame application | LST updates land on the store without per-frame trig |
| 6 | Build the composite rotation: hour-angle rotation about the polar (Z) axis, then a separate colatitude tilt about an east-west axis, composed into one quaternion | Fix/clarification: a single-axis azimuth spin gets azimuth right but altitude wrong — this must be two composed rotations, not one | Rotation verified correct against a reference alt-az calculator for a known star/time/location |
| 7 | Apply that quaternion to a root `Object3D` wrapping Stars/Constellations/SolarSystem/Satellites layers, inside the existing `useFrame` | This part is cheap per-frame — only applying an already-computed quaternion | Whole sky rotates together as one transform, no per-object recompute |
| 8 | Unit test: known star's RA/Dec → correct alt/az for a known observer + time | New | Test suite green |
| 9 | Device test: permission-denied UX path and real GPS fix both verified on-device | New | Both paths functional |

## Milestone 6 — Tap-to-Identify & UI Labels

| # | Task | What changed vs. original plan | Definition of done |
| :--- | :--- | :--- | :--- |
| 1 | Add `@gorhom/bottom-sheet` dependency (planned earlier, never installed) | — | Package installed |
| 2 | Build prominence filter: top-30 entities across stars/Sun/Moon/planets/satellites by brightness, recomputed only when underlying data updates | — | Stable top-30 list, not per-frame recomputed |
| 3 | Add `Gesture.Tap()` to the existing pan/pinch composition in `SkyMapScreen.tsx` | — | Tap detected without breaking pan/pinch |
| 4 | On tap: project each of the 30 candidates' 3D positions to 2D screen space via `camera.project()`-style math | Fix (replaces Raycaster): `THREE.Raycaster`'s Points hit-test assumes `PointsMaterial`'s size attenuation; your custom shader computes `gl_PointSize` per-star, so the raycaster's threshold won't track actual on-screen size — small/dim stars become hard to tap | Screen coordinates computed correctly for all 30 candidates on tap |
| 5 | Nearest-point-within-radius test against the tap coordinate, radius scaled per-entity by magnitude/point size | Simpler and cheaper than raycasting — 30 comparisons, not a scan against the full point cloud | Correct entity selected for a range of test taps |
| 6 | Dispatch matched entity's metadata (name, magnitude, distance where available, type) to Zustand | — | Store updates on match, no-ops on miss |
| 7 | Build `InfoBottomSheet` wired to that slice; dismiss on backdrop tap | — | Sheet shows correct info, dismisses cleanly |
| 8 | Accessibility pass: label contrast, minimum touch target size on the sheet's controls | New | Passes a basic accessibility check |
| 9 | Unit test: projection + nearest-match logic against known screen coordinates with a mocked camera | New | Test suite green |
| 10 | Device test: tap accuracy across star sizes/screen densities | New | Correct hits across a range of device screen sizes |

## Milestone 7 — Production & Play Store Readiness (new — run in parallel with 3–6, not after)

| # | Task | Definition of done |
| :--- | :--- | :--- |
| 1 | Jest unit tests for every pure math module (`Coordinates.ts`, `SiderealTime.ts`, `EphemerisService.ts`) — write as each module lands, not retroactively | Coverage on math layer is non-trivial by the time M6 ships |
| 2 | Explicit fallback UI for: location permission denied, no GPS fix, no network (TLE fetch fails), missing/corrupt catalog asset | Each failure mode has a designed state, not a crash or blank screen |
| 3 | Draft and host a Privacy Policy URL covering location data use | URL live before submission |
| 4 | Complete Play Console's Data Safety form accurately for location collection/use/sharing | Form submitted, matches actual app behavior |
| 5 | Write Android runtime permission rationale copy for the location prompt | Rationale shown before/at permission request |
| 6 | Credits/About screen: HYG database, constellation-line dataset, CelesTrak, `astronomy-engine` (MIT), `satellite.js`, any other bundled third-party data | All sources attributed |
| 7 | Integrate crash reporting (e.g. Sentry) | Crashes visible post-release, not just anecdotal reports |
| 8 | Device performance matrix: at least one low-end and one mid-range Android device, not just your dev phone | FPS/battery/GPS behavior verified off dev hardware |
| 9 | EAS Build signed-release config, `versionCode`/`versionName` strategy | Reproducible signed builds |
| 10 | Confirm `targetSdkVersion` for the in-use Expo SDK meets Play Store's current minimum at submission time | Compliant at time of upload |
| 11 | Store listing assets: icon, screenshots, description, age-rating questionnaire | Listing ready to submit |

> **Sequencing note:** Don't save Milestone 7 for the end. Items 1–2 are cheapest to do inline as each milestone's code lands; items 3–6 can be drafted alongside M4–M5 once you know what data/permissions you're actually shipping; only 8–11 genuinely wait until you're close to submission.