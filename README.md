# oneSky 🌌

**Version:** 1.0.0 (Production Release)

oneSky is a highly performant, offline-first 3D stargazing application. I built this project to bring a mathematically accurate, interactive celestial sphere to mobile devices using React Native, WebGL, and React Three Fiber.

Unlike traditional apps that rely heavily on constant API fetching and heavy DOM/View layers, oneSky is architected to perform complex astronomical calculations and render 3D environments smoothly at 60fps, even on lower-end Android devices, entirely without an internet connection.

## 🚀 Features (v1.0.0)

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

## 🗂️ Folder Structure

```text
oneSky/
├── assets/
│   ├── icons/                 # SVG icons for the HUD and Drawer
├── src/
│   ├── astro/
│   │   ├── EphemerisService.ts  # Astronomical math for celestial body positions
│   │   └── SatelliteService.ts  # TLE fetching for ISS/satellite tracking
│   ├── data/
│   │   ├── constellationLines.ts # Hipparcos mappings for constellation figures
│   │   ├── entityDetails.ts      # Offline dictionary of famous bodies and stars
│   │   └── starCatalog.ts        # The HYG star database subset
│   ├── math/
│   │   └── Coordinates.ts        # RA/Dec to Cartesian spherical transformations
│   ├── render/
│   │   ├── compassGeometry.ts    # Reanimated worklets for 2D UI compass projections
│   │   ├── entityGeometry.ts     # Pure math for LOD fading, tap picking, and projection
│   │   ├── groundGrid.ts         # GLSL fragment shader and uniform generators for the terrain
│   │   ├── LabelLayer.tsx        # Camera snapshot publisher and Reanimated UI text
│   │   ├── sceneRefs.ts          # Global Three.js refs
│   │   ├── SceneReadySignal.tsx  # Shader compilation probe
│   │   ├── SelectionManager.tsx  # Tap hit-testing resolver
│   │   └── SkyCanvas.tsx         # Primary React Three Fiber Canvas setup
│   ├── screens/
│   │   └── SkyMapScreen.tsx      # Main application screen container
│   ├── store/
│   │   ├── useAppReadyStore.ts   # Boot sequence and loading screen orchestrator
│   │   ├── useCameraStore.ts     # Camera FOV and zoom state
│   │   ├── useCelestialStore.ts  # Live ephemeris and TLE state
│   │   ├── useLocationStore.ts   # GPS and permission handling
│   │   ├── useSelectionStore.ts  # Entity selection state for the bottom sheet
│   │   └── useUIStore.ts         # HUD, Drawer, and Overlay state
│   ├── theme/
│   │   ├── colors.ts             # Global design system tokens
│   │   ├── typography.ts         # Scalable typography configurations
│   │   └── useLayout.ts          # Responsive layout hooks
│   └── ui/
│       ├── fallbacks/
│       │   ├── ErrorCard.tsx                # Reusable fallback UI card
│       │   ├── LocationPermissionScreen.tsx # Custom pre-permission rationale
│       │   └── OfflineBadge.tsx             # Quiet network failure indicator
│       ├── CreditsOverlay.tsx    # Technical attributions and dataset credits
│       ├── Drawer.tsx            # Animated hamburger navigation menu
│       ├── HUDOverlay.tsx        # Main Heads-Up Display and FAB tools
│       ├── InfoBottomSheet.tsx   # Reanimated bottom sheet for celestial details
│       ├── LoadingScreen.tsx     # Animated boot sequence
│       └── LocationOverlay.tsx   # Manual city selection dropdown
├── App.tsx                       # Root orchestrator
├── app.json                      # Expo configuration
├── eas.json                      # EAS build profiles (APK/AAB)
└── RELEASE_CHECKLIST.md          # Google Play Store handoff and publishing guide
```

## 🛠️ Tech Stack

- **Core:** React Native, TypeScript, Expo
- **3D Engine:** Three.js, React Three Fiber (`@react-three/fiber/native`)
- **Shaders:** GLSL (WebGL2)
- **Animations:** React Native Reanimated, React Native Gesture Handler
- **State Management:** Zustand
- **Local Data:** Derived from HYG Database and CelesTrak

## 👨‍💻 Author

**Piyush Atrish**  
Final year Electronics and Communication Engineering (ECE) student at Delhi Technological University (DTU).