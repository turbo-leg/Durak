# Browser validation

Use two terminals for `npm run dev:server` and `npm run dev:client`, or `npm run dev` for the cross-platform launcher. Open `http://localhost:5173`. The server can run without MongoDB in development; persistence and real account-provider integration require configured services.

The installed Playwright skill uses its CLI. On this Windows workspace the equivalent direct invocation is:

```powershell
npx --yes --package @playwright/cli playwright-cli -s=durak open http://localhost:5173/
npx --yes --package @playwright/cli playwright-cli -s=durak snapshot
```

Take a fresh snapshot before using element references. Navigate through Solo → High Roller to test a real bot match, or create a private table and join its complete, case-sensitive code in a second browser session. Do not edit application/package files while validating a match: development hot reload can reset React contexts or restart the server.

## Repeatable checks

After starting a 3D match, the play-through driver uses only accessible public table text and the same keyboard/action controls a player uses. It never reads authoritative server state or opponent hands:

```powershell
npx --yes --package @playwright/cli playwright-cli -s=durak run-code --filename scripts/browser-playthrough.js
```

For two human-client sessions, run the driver for each session concurrently. It stops at game-over, 100 local actions or its bounded wait budget. This is a deterministic smoke driver, not a competitive bot or proof that every possible match terminates. The server's seeded full-match suite provides additional 2–6-player/configuration coverage.

After starting a match, exercise WebGL context loss and four 2D/3D switch cycles:

```powershell
npx --yes --package @playwright/cli playwright-cli -s=durak run-code --filename scripts/browser-fallback-check.js
```

The fallback check requires the browser's `WEBGL_lose_context` extension. It verifies removal of the lost canvas, an explicit playable 2D fallback and one active canvas after returning to 3D. It does not measure physical-device GPU memory.

Resize to `390 × 844` and `1280 × 800`, check card controls/turn visibility, and capture screenshots under ignored `output/playwright/`:

```powershell
npx --yes --package @playwright/cli playwright-cli -s=durak resize 390 844
npx --yes --package @playwright/cli playwright-cli -s=durak screenshot --filename output/playwright/three-table-mobile.png
```

Network tests in `packages/server/tests/multiplayerIntegrity.test.ts` cover decoded snapshots/patches, owner-only hands, private logs/deck order, spectator access, Huzur exchange, pickup/refill, reconnect/rematch, signed identities, impersonation rejection and malformed traffic.

## Completed local checks

- A real Solo hard-bot match reached game-over after 24 driver actions; a rematch dealt fresh hands.
- Two isolated browser clients finished the same private 3D match, with 21 driver actions per client and zero browser errors. Both voted for a rematch.
- A further Solo match finished after 19 driver actions. `scripts/browser-rematch-reconnect.js` then started a rematch, refreshed the page and verified recovery of the active game, a saved token and one canvas. This caught and verified a fix for the token being cleared at game-over and never restored for the next match. The script returns only token presence, never credentials.
- Desktop and mobile viewport rendering, keyboard selection/defense, the explicit view switch and forced context-loss fallback were exercised.
- Four fallback/view-switch cycles completed with one active canvas after restoration.
- Transient Colyseus informational handler-registration warnings occurred around join/reconnect; no browser errors occurred in the successful multiplayer or rematch/refresh checks.
- Network privacy tests and seeded complete matches pass. Browser viewport emulation does not substitute for real iOS/Android performance testing.

Production-shaped containers, MongoDB writes, Redis scale-out, external Discord OAuth and physical mobile devices remain separate acceptance targets. See PROJECT_PLAN.md for the latest results.

## Replacement frontend acceptance

The active screen tree is now `room/CardRoom.tsx`; the drivers were updated for its native buttons and card-control toggle.

- Solo finished after 28 actions through the new interface; rematch/refresh recovered the active room with one canvas.
- New private setup → case-sensitive code → second client joins → ready → host starts → complete match passed. The host driver performed 20 actions and guest 21; neither browser reported errors.
- `scripts/browser-scene-check.js`, run on the opening screen, clicks actual canvas card locations and checks selection via public button state, then drags the table and verifies the rendered image changes. Both picking and bounded orbit passed.
- Updated fallback driver passed forced context loss and four view-switch cycles with one restored canvas. Transient Colyseus handler-registration warnings still occur around reconnect.
- Reviewed `output/playwright/rebuild-home-desktop.png`, `rebuild-game-desktop.png`, `rebuild-home-mobile-final.png` and `rebuild-game-mobile.png`. Artifacts are ignored local screenshots. Mobile is browser viewport emulation, not physical-device evidence.
- A further Solo match finished at the 390×844 viewport after 28 driver actions using the mobile-default card controls. Native rules dialog labeling was verified through its accessible name. The final desktop home is captured in `rebuild-home-desktop-final.png`.

Public room discovery, actual email/Discord authentication, purchases and persistence still need production-shaped integration checks. The replacement UI includes account entry, but the old shop/statistics/history screens are intentionally outside the active composition pending their redesign.
