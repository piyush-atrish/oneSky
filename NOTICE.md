# Notices

oneSky includes the third-party material below. Each item stays under its own licence. The same information
is shown in the app under **About > Open-source licences**.

## Sky data (CC BY-SA 4.0)

| Data | Source and authors | Licence | Changes made for oneSky |
| :--- | :--- | :--- | :--- |
| Star positions, magnitudes and colour indices (`src/data/starCatalog.ts`) | HYG database v4.1 by David Nash (Astronexus), https://github.com/astronexus/HYG-Database, compiled from the Hipparcos, Yale Bright Star and Gliese catalogs | CC BY-SA 4.0 | Filtered to magnitude 6.5 or brighter, duplicates merged, columns reduced, values rounded |
| Constellation names and lines (`src/data/constellationLines.ts`, names in `src/data/entityDetails.ts`) | Stellarium "modern" sky culture by the Stellarium team, https://github.com/Stellarium/stellarium (`skycultures/modern`) | Text and data CC BY-SA 4.0 | Polylines of Hipparcos numbers converted to pairs |
| Planet, Moon and Sun figures (`src/data/entityDetails.ts`) | NASA NSSDCA planetary fact sheets, https://nssdc.gsfc.nasa.gov/planetary/factsheet/ | Public facts, credited | Selected and reformatted |

The resulting data files are shared under CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/legalcode)
and are published with their build scripts at https://github.com/piyush-atrish/onesky-data.
The exact upstream commits are recorded in the header comment of each data file.
Descriptions and subtitles in `entityDetails.ts` are original text written for oneSky.

## Fonts (SIL Open Font License 1.1)

| Font | Copyright |
| :--- | :--- |
| Righteous (`@expo-google-fonts/righteous`) | Copyright (c) 2011 by Brian J. Bonislawsky DBA Astigmatic (AOETI), with Reserved Font Name "Righteous" |
| Roboto (`@expo-google-fonts/roboto`) | Copyright 2011 The Roboto Project Authors (https://github.com/googlefonts/roboto-classic) |

The full licence text ships with each font package and is shown in the app.

## JavaScript packages

The Android release bundle contains open-source packages whose exact list, versions and licences are generated into
`src/data/thirdPartyNotices.ts` (see "Licence mix" printed by `scripts/generate-notices.mjs`). At the time of writing
they are MIT, ISC and BSD-3-Clause packages plus the two font packages above (MIT code). No GPL, LGPL or AGPL
package is included in the app. Full copyright lines and licence texts are in `src/data/thirdPartyNotices.ts`,
built from `scripts/bundled-packages.json`. Regenerate both whenever dependencies change
(see `docs/LICENSES-AUDIT.md`, Phase 3 record).

Notable libraries: React and React Native (Meta Platforms, Inc. and affiliates), Expo (650 Industries, Inc.),
three.js (three.js authors), React Three Fiber (Poimandres), astronomy-engine (Don Cross),
satellite.js (Shashwat Kandadai and UCSC Jack Baskin School of Engineering), Zustand (Paul Henschel),
React Native Reanimated, Gesture Handler and SVG (Software Mansion).

## Native Android components

The Android app also contains native components that ship with React Native and Expo. They are open source and
used under their own licences (mostly MIT, BSD and Apache-2.0). Verify the exact list against the release
build before publishing (Phase 8 of `docs/LICENSES-AUDIT.md`).

## Orbit data

Satellite orbital elements are downloaded at run time from CelesTrak (https://celestrak.org).

## Artwork

- The app icon and logo were drawn for oneSky.
- The interface icons are IconScout free icons, credited in the app (About screen) to Hajicon (info), Directico Kit
  (terrain, space station), Phosphor Icons (planet, MIT licence, Copyright (c) 2020 Phosphor Icons), Garoks
  (constellation), HJ Project (tools) and Uniconlabs (location), used under IconScout's free licence terms.
- The loading-screen clouds, telescope, menu icon and selection triangle are placeholder artwork whose original
  source has not been recorded. The interface artwork is planned to be redesigned by the party taking over the app.