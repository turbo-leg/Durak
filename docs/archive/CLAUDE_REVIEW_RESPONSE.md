# Claude review response — 2026-10-21

This records implementation following the user's pasted independent review.
Review the current local working tree, including untracked files. No deployment
or destructive cleanup was performed. The custom engine rules are unchanged.

## Findings and disposition

| Review item                                     | Disposition and evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Horse stale timer resets a new game          | Fixed in `packages/server/src/rooms/DurakRoom.ts`: a retained room-clock timer is cleared on start/disposal, and its callback checks the phase/mode. Interim Horse rematch votes are rejected server-side and the UI hides that button.                                                                                                                                                                                                                                                                                                                                                         |
| 2. Horse winner/reset missing                   | Fixed: results derive the winner and scores from synchronized state, so late consumers do not depend on an ephemeral broadcast. Completed-match rematches require the existing human vote consensus, then reset both letter strings and game number. Intermediate games retain letters and return to the lobby. Drawn games also continue without awarding a letter.                                                                                                                                                                                                                            |
| 3. Team result contradicts outcome              | Fixed in `packages/client/src/room/CardRoom.tsx`: result text compares the loser's team to the local team. Spectators receive neutral team results. Horse distinguishes a sub-game result from the whole match.                                                                                                                                                                                                                                                                                                                                                                                 |
| 4. Expired login blocks all entry paths         | Fixed in `contexts/AuthContext.tsx`, `contexts/GameContext.tsx`, `game/sessionToken.ts` and `discordAuth.ts`. Locally expired/malformed sessions are cleared. All five entry paths can join as guests; a server-invalid/expired-token response triggers at most one guest retry. Identity claims are stripped on guest fallback. Server signature/identity verification is unchanged. Unrelated join errors do not clear login or retry.                                                                                                                                                        |
| 5. Wrong card origins/destinations              | Addressed in `components/three/TableRenderer.ts`: known cards share one identity-keyed mesh across hand, attack, history and Huzur. Reparenting preserves the current world position. Revealed table cards originate at the previously active remote seat. Remote pickup destinations require public hand-count growth; identities become hidden again. A destination that cannot be established is retired quietly, rather than invented as a discard. Exact choreography for anonymous remote Huzur swaps would benefit from a future public action-event stream; it is not claimed complete. |
| 6. History rebuilt after 14 cards               | Fixed: identity keys no longer include a moving slice index. Existing meshes survive window advancement; older off-window history retires quietly.                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 7. Continuous full-rate idle GPU use            | Mitigated: active movement retains normal pacing; settled idle avatar updates run at about 4 fps for narrow/coarse-pointer views and 8 fps for desktop. Reduced motion remains event-driven. Mobile quality caps DPR at 1.5, disables clearcoat/shadows and caps face anisotropy at 4. Physical-phone power/thermal cost is still unmeasured.                                                                                                                                                                                                                                                   |
| 8. Vertical touch drag cancellation             | Canvas uses `touch-action:none`. Chromium touch emulation delivered six vertical move events, no pointer cancellation, and a changed rendered view with reduced motion enabled. Physical-phone scrolling/gesture acceptance remains outstanding. Scrolling outside the canvas remains available.                                                                                                                                                                                                                                                                                                |
| 9. Returning hand card has wrong parent         | Fixed: every reused card is attached to the correct scene/hand parent, with its geometry, rotation order, material and scale updated for that zone.                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 10. Huzur foreshortening and clipped deck label | Adjusted: the Huzur has a modest tilt with its lower edge above the felt. The overlapping world-space deck label was removed; the existing DOM caption still shows the count at all angles. Desktop/mobile screenshots were reviewed. Overall card presentation remains subject to visual approval.                                                                                                                                                                                                                                                                                             |
| 11. Defense action copy                         | Fixed: the empty-selection action prompt now says “Choose your defense.” while defending.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 12. Oversized HUD download                      | Fixed: the small HUD uses the regular 512 × 744 face; the 3D Huzur retains the higher-resolution texture. Chromium confirmed the HUD loads the 512-pixel image.                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 13. Failed HD request loses regular art         | Fixed: a failed upgrade explicitly loads regular art. A failed-upgrade flag prevents repeated attempts on every scene update. The generated fallback remains the last resort.                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 14. Constructor failure leaks renderer          | Fixed: initialization after WebGL renderer creation is guarded; partial resources, canvas and context are disposed before rethrowing to React's fallback. Cleanup tolerates uninitialized controls/observer.                                                                                                                                                                                                                                                                                                                                                                                    |
| 15. Ambiguous fallback Joker labels             | Fixed: 2D generated fallback uses BJ/RJ, matching the 3D fallback.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 16. Incorrect notation ranks/Jokers             | Fixed in server `formatCard`: 17/18 → BJ/RJ, 14/15/16 → 3/2/A. `GAME_NOTATION.md` now states current emitted notation and labels its legacy examples as requiring reconciliation.                                                                                                                                                                                                                                                                                                                                                                                                               |

A related result-panel defect was also fixed: `GameContext` stored rematch
voters by username while the UI checked session IDs. It now stores session IDs
and clears the voting display when play resumes.

## Validation

- Full `npm test`: **346 passing tests across 40 files**: client 131, server 149,
  shared 66. Output: `output/claude-review-tests.log`.
- `npm run typecheck` passed across all workspaces during the pass. The final
  root production build also checks client, server and shared TypeScript.
- `npm run lint` passed (client is the workspace with a lint script).
- `npm run build` passed. Output: `output/claude-review-build.log`. Server/shared
  build scripts are no-emit checks; the client produces the bundled artifact.
- A final focused card-motion check passed after tightening pickup inference;
  the client build/lint are repeated after that small final adjustment.
- New regressions: `packages/server/tests/horseLifecycle.test.ts`,
  `packages/client/src/test/GameSession.test.tsx`, `cardMotion.test.ts`,
  `rendererFailure.test.ts`, plus team/Horse cases in `CardRoom.test.tsx`.
- Two independent browser clients completed create/join/ready/start, a confirmed
  card play, head turn/recenter, portrait/landscape layouts, seven-card references
  down to 320 px, reduced-motion idle behavior and forced WebGL fallback. No
  application exceptions were recorded. Script: `output/playwright/avatar-check.js`.
- A separate settled mobile/coarse-pointer emulation sampled **3 rendered frames
  in one second**, **zero idle frames with reduced motion**, and successful
  vertical touch input without cancellation. This is a short desktop-Chromium
  sample, not a physical-device performance guarantee. Script:
  `output/playwright/review-idle-touch.js`.
- Visual artifacts: `output/playwright/avatar-peer-looking.png`,
  `avatar-mobile-portrait.png`, `review-mobile-touch.png`, `review-desktop.png`.
  Output artifacts remain local and may not be tracked by Git.

Vite's existing config-migration and large Three.js chunk warnings remain.
No external OAuth, MongoDB/Redis persistence, embedded Discord client, physical
phone, container deployment or production release was validated in this pass.

## Rule/product decisions deliberately left unchanged

1. Whether discarded card identities should remain public.
2. Whether an empty-table timeout should play `hand[0]` or the lowest card.
3. Whether Horse uses `eloClassic` or a separate/team rating pool.

These are rule/product choices, not corrections to make from a reviewer's
assumption. Current behavior remains in place pending the user's decision.

## Suggested next acceptance work

Run a complete Horse match/rematch in the browser, inspect paired-card and
pickup animation visually in 4–6-player games, and test gestures, legibility,
frame pacing and thermal behavior on physical phones. Then review embedded
Discord behavior. Reassess the remaining production-integration and dependency
blockers separately from these local correctness fixes.
