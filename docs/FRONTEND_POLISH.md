# Frontend usability pass — 2026-10-21

Retained the blue felt room, held 3D fan, custom game rules and explicit confirmation before playing. Used frontend-design and Playwright skills; no additional skill installation was needed.

## Changes

- Held cards enter from the world-space deck and leave toward the world-space discard rather than moving toward an invalid camera-local destination.
- Long keyboard hands use safe centering so the first card remains reachable when the row overflows. Focused cards lift visibly.
- Mobile play actions remain available while scrolling, respect the bottom safe area, and have larger touch targets. Messages appear above the play controls.
- The 2D table includes Huzur and accumulated table cards, with accessible card names and scrolling for large collections.
- Switching from an odd classic seat count to Teams/Horse resets to four supported seats. Room codes can be submitted with Enter; clipboard unavailability gives a copyable code rather than throwing.
- Open-table discovery and sign-in show waiting feedback. Clicking dialog padding no longer dismisses it. The timer no longer requests a live announcement each second.

## Validation

Client tests, ESLint and production build (including TypeScript) pass. Regression coverage includes five-seat Classic → Horse and accumulated cards/Huzur in 2D.

Browser review: 1280×720 desktop, 390×844 and 320×740 mobile viewports; rules dialog and Escape; Classic five-seat → Teams four-seat correction; solo join; card selection and successful defense; 2D/3D switching; Huzur display; mobile action fit. No application console errors observed. Screenshots are under `output/playwright/polish-*`.

## Remaining validation

- These are desktop Chromium mobile viewports, not physical iOS/Android GPU or touch tests.
- No fresh authenticated purchase, Discord OAuth, or multiplayer end-to-end run was performed in this pass. Prior broader validation is recorded separately.
- Vite still reports its existing config migration and large Three.js chunk warnings.
