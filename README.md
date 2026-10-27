# oneSky 🌌

**Version:** 1.1.0

oneSky is a highly performant, offline-first 3D stargazing application. I built this project to bring a mathematically accurate, interactive celestial sphere to mobile devices using React Native, WebGL, and React Three Fiber.

Unlike traditional apps that rely heavily on constant API fetching and heavy DOM/View layers, oneSky is architected to perform complex astronomical calculations and render 3D environments smoothly at 60fps, even on lower-end Android devices, entirely without an internet connection.

## 🆕 What's new in 1.1.0

- **ISS tracking that survives being offline.** The International Space Station's orbit data is now saved on the device and reused for up to 7 days, so the ISS keeps moving on the map without a connection. The app refreshes it at most once every 2 hours, and stops requesting after any server error, following CelesTrak's usage policy.
- **Open-source licences screen.** *About → Open-source licences* lists every library, font and dataset the app ships, with its copyright line and licence text.
- **Cleaner data provenance.** The star catalog is rebuilt from the official HYG v4.1 database, constellation lines come from Stellarium's "modern" sky culture, and all object descriptions are original text. The data files are shared under CC BY-SA 4.0 (see [Licensing](#-licensing)).
- **Minimal permissions.** Only approximate location, precise location and internet. No background location, no storage access.
- **Privacy information in the app.** The About screen links to the privacy policy.
- **Expo SDK 58** and updated dependencies.

## 🚀 Features

- **Offline-First Ephemeris Engine:** Calculates planetary positions, star coordinates, and constellation lines locally.
- **Interactive 3D Sky Map:** A WebGL-powered celestial sphere that users can pan, zoom, and explore.
- **Custom Hardware-Accelerated Terrain:** A high-performance polar grid terrain utilizing a custom WebGL2 GLSL fragment shader (`fwidth` anti-aliasing) to render a pristine horizon without the geometry overhead of traditional 3D line segments.
- **Level of Detail (LOD) Rendering:** Implemented custom projection math to map 3D coordinates to the 2D UI thread, allowing dynamic text labels and cardinal direction markers (N/E/S/W) to fade in and out based on the camera's Field of View (FOV) without choking the GPU or clipping the terrain.
- **Defensive Gesture Architecture:** Custom, race-condition-free state machines handle pinch-to-zoom scaling dynamically, guaranteeing smooth, continuous scaling directly from the physical camera's live FOV.
- **Asynchronous Boot Orchestration:** A robust state machine handles heavy shader compilation, asynchronous font loading, and location fetching behind a smooth, uninterrupted Reanimated entrance sequence.
- **Hardware-Accelerated HUD:** A Heads-Up Display and sliding drawer navigation built entirely with `react-native-reanimated`, ensuring all gesture handling and animations stay off the JS thread.
- **Graceful Degradation:** Custom fallback UI components handle denied location permissions, failed GPS locks, and missing network connectivity gracefully.

## ⚙️ Architecture & How It Works

My goal was to maintain absolute strictness between the 3D rendering context and the React Native UI layer.

Instead of rendering expensive text meshes inside the 3D canvas, the app utilizes a "snapshot" technique. A `LabelLayer` and `CompassLayer` inside the Three.js canvas publish a small matrix snapshot of the camera per frame. Ordinary React Native text components sit completely outside the canvas, reading this snapshot via Reanimated worklets to position themselves on the UI thread. This completely decouples the UI from the render loop, ensuring crisp typography, perfect z-indexing over the 3D terrain, and zero React re-renders while the user pans the sky.

State management is handled by highly isolated **Zustand** stores (`useUIStore`, `useCelestialStore`, `useLocationStore`, `useAppReadyStore`), ensuring that a change in the HUD does not trigger unnecessary re-renders in the heavy 3D engine. Tap-picking and hit-testing rely on pure mathematical raycasting against a local, statically typed dictionary, bypassing the need for network latency when identifying a star or planet.

### ISS orbit data (new in 1.1.0)

`TleCache.ts` holds the download policy and has no React Native imports, so it is unit-tested on its own. A copy younger than 2 hours is used without any request; after any non-200 reply no request is made for 2 hours, even across app restarts; offline failures retry at most once a minute; a saved copy older than 7 days is ignored. `TleFileStorage.ts` saves the data in the app's cache folder. If many devices share one network (for example a school), set `EXPO_PUBLIC_TLE_PROXY_URL` to use a cache proxy instead of calling CelesTrak directly (see `docs/TLE_PROXY_STRATEGY.md`).

## 🗂️ Folder Structure

```text
oneSky/
├── assets/
│   ├── icons/                     # SVG icons for the HUD and Drawer
├── docs/
│   └── TLE_PROXY_STRATEGY.md      # Optional cache proxy for shared networks
├── scripts/
│   ├── generate-notices.mjs       # Builds src/data/thirdPartyNotices.ts
│   ├── list-bundled-packages.mjs  # Lists the packages inside the release bundle
│   └── bundled-packages.json      # Output of the list step, input of the notices step
├── src/
│   ├── astro/
│   │   ├── EphemerisService.ts    # Astronomical math for celestial body positions
│   │   ├── SatelliteService.ts    # ISS orbit download and position (SGP4)
│   │   ├── TleCache.ts            # Cache and back-off policy for orbit data
│   │   ├── TleFileStorage.ts      # Saves orbit data in the app cache folder
│   │   └── TimeMath.ts            # Julian date and sidereal time
│   ├── data/
│   │   ├── constellationLines.ts  # Hipparcos mappings for constellation figures
│   │   ├── entityDetails.ts       # Offline dictionary of famous bodies and stars
│   │   ├── starCatalog.ts         # The HYG star database subset
│   │   └── thirdPartyNotices.ts   # Generated licence notices for bundled packages
│   ├── math/
│   │   ├── Coordinates.ts         # RA/Dec to Cartesian spherical transformations
│   │   └── HorizonRotation.ts     # Sky-to-horizon rotation for the observer
│   ├── render/
│   │   ├── compassGeometry.ts     # Reanimated worklets for 2D UI compass projections
│   │   ├── entityGeometry.ts      # Pure math for LOD fading, tap picking, and projection
│   │   ├── groundGrid.ts          # GLSL fragment shader and uniform generators for the terrain
│   │   ├── LabelLayer.tsx         # Camera snapshot publisher and Reanimated UI text
│   │   ├── sceneRefs.ts           # Global Three.js refs
│   │   ├── SceneReadySignal.tsx   # Shader compilation probe
│   │   ├── SelectionManager.tsx   # Tap hit-testing resolver
│   │   └── SkyCanvas.tsx          # Primary React Three Fiber Canvas setup
│   │   (plus StarsLayer, ConstellationsLayer, SolarSystemLayer, SatelliteLayer, HorizonLayer, CompassLayer, CameraManager)
│   ├── screens/
│   │   └── SkyMapScreen.tsx       # Main application screen container
│   ├── store/
│   │   ├── useAppReadyStore.ts    # Boot sequence and loading screen orchestrator
│   │   ├── useCameraStore.ts      # Camera FOV and zoom state
│   │   ├── useCelestialStore.ts   # Live ephemeris and ISS orbit state
│   │   ├── useLocationStore.ts    # GPS and permission handling
│   │   ├── useSelectionStore.ts   # Entity selection state for the bottom sheet
│   │   └── useUIStore.ts          # HUD, Drawer, and Overlay state
│   ├── theme/
│   │   ├── colors.ts              # Global design system tokens
│   │   ├── typography.ts          # Scalable typography configurations
│   │   └── useLayout.ts           # Responsive layout hooks
│   └── ui/
│       ├── fallbacks/
│       │   ├── ErrorCard.tsx                # Reusable fallback UI card
│       │   ├── LocationPermissionScreen.tsx # Custom pre-permission rationale
│       │   └── OfflineBadge.tsx             # Quiet network failure indicator
│       ├── CreditsOverlay.tsx     # About screen: credits, privacy link, open-source licences
│       ├── Drawer.tsx             # Animated hamburger navigation menu
│       ├── HUDOverlay.tsx         # Main Heads-Up Display and FAB tools
│       ├── InfoBottomSheet.tsx    # Reanimated bottom sheet for celestial details
│       ├── LoadingScreen.tsx      # Animated boot sequence
│       └── LocationOverlay.tsx    # Manual city selection dropdown
├── __tests__/                     # Jest unit tests (math, ephemeris, data integrity, TLE cache)
├── App.tsx                        # Root orchestrator
├── app.json                       # Expo configuration
├── eas.json                       # EAS build profiles (APK/AAB)
├── LICENSE                        # What is proprietary, what is CC BY-SA, what is third-party
└── NOTICE.md                      # Sources, authors and licences of bundled material
```

## 🛠️ Tech Stack

- **Core:** React Native, TypeScript, Expo (SDK 58)
- **3D Engine:** Three.js, React Three Fiber (`@react-three/fiber/native`)
- **Shaders:** GLSL (WebGL2)
- **Animations:** React Native Reanimated (with `react-native-worklets`), React Native Gesture Handler
- **State Management:** Zustand
- **Astronomy:** `astronomy-engine` (planets, Sun, Moon) and `satellite.js` (SGP4 for the ISS)
- **Local Data:** HYG star database v4.1, Stellarium "modern" sky culture, NASA planetary fact sheets, and ISS orbit data from CelesTrak

## 🏁 Getting Started

```bash
npm install
npm start                # Expo dev server (press "a" for Android)
npm test                 # Jest unit tests
npx tsc --noEmit         # Type check
npx expo-doctor          # Project health check
```

### Building

Builds use EAS (`eas.json`):

```bash
eas build --platform android --profile preview      # installable APK for testing
eas build --platform android --profile production   # signed bundle for Google Play
```

The version shown to users is `expo.version` in `app.json` (currently 1.1.0). The Android version code is managed remotely by EAS and increments automatically on production builds.

### Keeping licence notices current

After any dependency change (including Expo upgrades), regenerate the notices so the About screen stays accurate:

```bash
npx expo export --platform android --output-dir dist --dump-sourcemap --no-minify
node scripts/list-bundled-packages.mjs
node scripts/generate-notices.mjs
```

The generator prints the licence mix and warns about any licence that is not on its permissive allow-list.

## 🔒 Privacy

- Your location is used **only on your device** to work out which sky is above you. It is kept in memory while the app runs and is never sent anywhere. Background location is never requested.
- The only network request is for the ISS's public orbit data from CelesTrak. It contains no information about you.
- No accounts, ads, analytics or crash reporting.

Privacy policy: <https://piyush-atrish.github.io/onesky-privacy/>

## 📜 Licensing

This repository has three kinds of material (details in [`LICENSE`](LICENSE) and [`NOTICE.md`](NOTICE.md)):

- **Application source code:** proprietary, © 2026 Piyush Atrish. All rights reserved unless a separate written agreement says otherwise.
- **Sky data** (`src/data/starCatalog.ts`, `constellationLines.ts`, `entityDetails.ts`): adapted from the HYG database and Stellarium's modern sky culture, shared under **CC BY-SA 4.0**. The data and its build scripts are also published at <https://github.com/piyush-atrish/onesky-data>.
- **Third-party libraries and fonts:** used under their own licences (MIT, ISC, BSD-3-Clause, SIL OFL 1.1). Full notices are in the app under *About → Open-source licences*.

## 👨‍💻 Author

**Piyush Atrish**  
Final year Electronics and Communication Engineering (ECE) student at Delhi Technological University (DTU).