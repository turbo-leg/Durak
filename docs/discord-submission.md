# Discord App Directory submission — prep checklist

This doc is the single-pass guide for submitting **Durak Online** to the [Discord App Directory](https://discord.com/build/app-directory). It covers what's verified in the repo, what assets the operator needs to upload, the pre-submission flight check, and the submission flow itself.

Issue: [#152](https://github.com/turbo-leg/Durak/issues/152). Submission is a manual action in the Discord Developer Portal — this checklist gets you ready to do it in one sitting.

---

## 1. Requirements checklist (repo-verified)

Status legend: ✅ done · ⚠ partial / needs maintainer attention · ❌ blocking

| #    | Requirement                                                         | Status | Evidence / Action                                                                                                                                                                                                                                                                        |
| ---- | ------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.1  | Application is built on the Embedded App SDK                        | ✅     | `@discord/embedded-app-sdk@^1.2.0` in `packages/client/package.json`                                                                                                                                                                                                                     |
| 1.2  | OAuth scopes are scoped to what's needed                            | ✅     | `identify`, `guilds` only — `packages/client/src/discordAuth.ts:26`                                                                                                                                                                                                                      |
| 1.3  | Server-side OAuth token exchange (no client secret in client)       | ✅     | `POST /api/token` at `packages/server/index.ts:115-155`                                                                                                                                                                                                                                  |
| 1.4  | URL Mapping configured for `https://durak-discord-activity.fly.dev` | ⚠      | Must be set in Developer Portal → Activities → URL Mappings. Not visible from repo.                                                                                                                                                                                                      |
| 1.5  | `Content-Security-Policy: frame-ancestors` allows Discord           | ⚠      | Currently `frame-ancestors *` (`packages/server/index.ts:108`). Overly permissive — blocked by issue [#188](https://github.com/turbo-leg/Durak/issues/188). Tighten to `https://discord.com https://*.discord.com https://canary.discord.com https://ptb.discord.com` before submitting. |
| 1.6  | HTTPS-only transport                                                | ✅     | `force_https = true` in `fly.toml`                                                                                                                                                                                                                                                       |
| 1.7  | Privacy Policy publicly accessible                                  | ⚠      | Drafts at `PRIVACY.md` / `TERMS.md` (PR [#216](https://github.com/turbo-leg/Durak/pull/216)). Must be merged so canonical GitHub URLs are live.                                                                                                                                          |
| 1.8  | Terms of Service publicly accessible                                | ⚠      | Same as 1.7                                                                                                                                                                                                                                                                              |
| 1.9  | App icon (1024×1024)                                                | ❌     | Operator must create. See §2.                                                                                                                                                                                                                                                            |
| 1.10 | Cover image                                                         | ❌     | Operator must create. See §2.                                                                                                                                                                                                                                                            |
| 1.11 | Screenshots                                                         | ❌     | Operator must capture from running build. See §2.                                                                                                                                                                                                                                        |
| 1.12 | App description (short + long)                                      | ⚠      | Drafts in §3 below — review and edit before submitting.                                                                                                                                                                                                                                  |
| 1.13 | Age rating questionnaire completed                                  | ⚠      | Must be answered in portal at submission time.                                                                                                                                                                                                                                           |
| 1.14 | E2E activity flow tested in Discord client                          | ⚠      | Blocked by [#126](https://github.com/turbo-leg/Durak/issues/126) — verify before submitting.                                                                                                                                                                                             |
| 1.15 | Regression test pass                                                | ⚠      | Blocked by [#151](https://github.com/turbo-leg/Durak/issues/151).                                                                                                                                                                                                                        |

## 2. Assets to prepare

The operator must create the following before opening the submission form. Dimensions follow current Discord guidance; **verify in portal at submission time** as Discord updates these specs without notice.

| Asset               | Spec (verify in portal)                                | Count | Notes                                                                 |
| ------------------- | ------------------------------------------------------ | ----- | --------------------------------------------------------------------- |
| App icon            | 1024×1024 PNG, square, transparent or solid background | 1     | The ♦ + green table aesthetic from the in-app header is a natural fit |
| Cover image         | ~1920×1080 PNG/JPG                                     | 1     | Landscape splash; show a game in progress                             |
| Screenshots         | 16:9 PNG/JPG, portal will reject too-low DPI           | 3–5   | See §2.1 for shot list                                                |
| Description (short) | ≤150 chars                                             | 1     | See §3                                                                |
| Description (long)  | ≤2000 chars                                            | 1     | See §3                                                                |

### 2.1 Screenshot shot list

Capture at 1920×1080 from a real game (run `npm run dev` and use the browser at `:5173` zoomed to fit):

1. **Lobby** — `<Lobby>` rendered, showing the "Create / Join" buttons and the friends/leaderboard panel
2. **Mid-game** — `<GameBoard>` with cards on the table, attacker/defender highlighting visible
3. **Achievement reveal** — a `SuhuhReveal` or post-game profile panel
4. **Discord embed** — the activity running inside an actual Discord voice channel (Developer Portal will recognize this aesthetic)
5. _(Optional)_ **Mobile** — phone-aspect screenshot taken inside the Discord mobile client

## 3. Draft description copy

### Short description (≤150 chars)

> Play Durak — the classic Russian card game — with up to 6 friends in your Discord voice channel. Quick matches, ELO ranks, achievements.

(Count: 142 chars.)

### Long description (≤2000 chars)

> **Durak Online** is a real-time multiplayer Durak card game built right into Discord. Launch it from any voice channel and play a 2–6 player match without ever leaving the call.
>
> Durak ("the fool") is a classic Russian shedding game: be the first to empty your hand by attacking and defending with the right combinations of suits and ranks. Whoever's left holding cards at the end is the _durak_ — and the next round begins.
>
> **Features**
>
> - 2–6 player matches with public and private rooms
> - Server-authoritative game state — no cheating, no desync
> - Persistent profiles with ELO, win/loss stats, and achievements
> - Optional email sign-in for solo browser play; Discord OAuth inside the embed
> - Server-side reconnection — drop a connection and pick up exactly where you left off
> - Built with the Discord Embedded App SDK on a Colyseus + React stack
>
> **Why Discord?**
> Durak is a social game; it belongs in the same voice channel you're already in. Open the activity, jump into a room, and start trash-talking.
>
> **Privacy first.** We only request `identify` and `guilds` scopes, store the minimum we need to track your stats, and provide a one-email deletion request flow. See our [Privacy Policy](https://github.com/turbo-leg/Durak/blob/main/PRIVACY.md) and [Terms](https://github.com/turbo-leg/Durak/blob/main/TERMS.md).
>
> Free to play. No ads. No in-app purchases. Just cards.

(Trim or expand to taste — current draft is ~1,400 chars.)

## 4. Pre-submission verification (do this in the real Discord client)

Run through each before opening the portal form:

- [ ] Activity launches from the voice channel **Activities** picker on **Desktop (Mac + Windows)**
- [ ] Activity launches on the **web client** (`discord.com/channels/...`)
- [ ] Activity launches on the **mobile client** (iOS + Android) — at minimum it should load without crashing; portrait orientation usable
- [ ] OAuth consent screen shows only `identify` and `guilds`
- [ ] Multi-player flow works: invite a second user, both join the same room
- [ ] Reconnection works: kill the client mid-game, relaunch, rejoin in <30s
- [ ] Sound/voice in Discord is unaffected when activity is running
- [ ] No console errors with severity ≥ warning during a full match
- [ ] Footer "Privacy" and "Terms" links open the canonical URLs (PR #216 must be merged)
- [ ] No PII or secrets visible in the rendered HTML (`view-source` on the activity URL)

Cap participants per room: `state.maxPlayers` defaults to 6, hard-limited to ≤6 by game logic (`packages/server/src/rooms/DurakRoom.ts:38`). The Colyseus `maxClients = 100` is intentional — spectators bypass the player cap. Mention spectator support in the submission notes only if it's been tested in Discord.

## 5. Submission flow (Discord Developer Portal)

The Developer Portal UI changes frequently — exact field names below are best-effort; **defer to whatever the portal asks**.

1. Open **https://discord.com/developers/applications** → select the Durak application.
2. Navigate to **App Directory** in the left nav. If "Submit for review" is not yet enabled, complete the prerequisite **Activities** and **OAuth2** sections first.
3. Confirm **App Information**:
   - Name: `Durak Online`
   - Tagline / short description: §3
   - Long description: §3
   - Category: **Games** (subcategory: Card / Tabletop, if offered)
   - Tags: `cards`, `multiplayer`, `tabletop`, `russian`, `social` (portal will cap the count)
4. Upload **Assets** from §2.
5. Set **Privacy Policy URL**: `https://github.com/turbo-leg/Durak/blob/main/PRIVACY.md`
6. Set **Terms of Service URL**: `https://github.com/turbo-leg/Durak/blob/main/TERMS.md`
7. Complete the **Age rating** questionnaire. Expected outcome: 13+ (no real-money gambling, no UGC, no chat). _Verify each answer against the actual feature set._
8. Confirm **OAuth scopes** list shows only `identify` and `guilds`.
9. Confirm **Default Install Settings**: User Install enabled if you want individuals to install; Guild Install enabled for server-level activity surface.
10. Confirm **Supported orientations** (likely both portrait + landscape — verify against mobile testing in §4).
11. Add a **Support contact email**: `tubulol12345@gmail.com`.
12. Add a **Support server invite** if available (skip otherwise).
13. Click **Submit for Review**.

## 6. Post-submission

- Review timeline is typically **1–4 weeks**; Discord may request changes.
- Monitor the email associated with the developer account daily during the review window.
- If rejected: read the rejection reason carefully, fix, and re-submit. Common rejection causes are missing/unreachable Privacy or Terms URLs, screenshots that don't show the actual app, and CSP `frame-ancestors *` (see #188 — must be tightened before resubmit).
- On approval, the activity appears in the App Directory. Promote in any relevant server you control.

## 7. Open issues blocking submission

These must be closed (or explicitly accepted as risk) before opening the portal form:

| Issue                                                 | Title                                                                         | Blocker?                                                  |
| ----------------------------------------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------- |
| [#196](https://github.com/turbo-leg/Durak/issues/196) | Draft PRIVACY.md and TERMS.md                                                 | **Yes** — Privacy & Terms URLs are required portal fields |
| [#198](https://github.com/turbo-leg/Durak/issues/198) | Rewrite README for ship-readiness                                             | Recommended — reviewers may visit the repo                |
| [#188](https://github.com/turbo-leg/Durak/issues/188) | Tighten production security headers (frame-ancestors, X-Content-Type-Options) | **Yes** — `frame-ancestors *` will likely fail review     |
| [#192](https://github.com/turbo-leg/Durak/issues/192) | Move `VITE_DISCORD_CLIENT_ID` out of Dockerfile into Fly build args           | Recommended — secret hygiene                              |
| [#195](https://github.com/turbo-leg/Durak/issues/195) | Accessibility audit                                                           | Recommended — Discord increasingly checks this            |
| [#197](https://github.com/turbo-leg/Durak/issues/197) | Distinguish "reconnecting…" from "waiting for opponent"                       | Recommended — UX polish reviewers notice                  |
| [#126](https://github.com/turbo-leg/Durak/issues/126) | End-to-end Discord Activity flow                                              | **Yes** — can't submit untested                           |
| [#151](https://github.com/turbo-leg/Durak/issues/151) | Full regression test pass                                                     | **Yes** — last-mile sanity check                          |

## 8. Items requiring maintainer-only verification

The following can't be confirmed from the repo and must be checked manually:

- Exact field names and dimension specs in the current Discord portal UI
- Age-rating questionnaire answers (chat features, gambling, UGC — answer based on actual current feature set)
- Locale list to advertise (English only? add Russian/Mongolian?)
- Whether spectator mode is in scope for v1 submission, and if so whether to highlight it
- Whether mobile orientation should be locked to portrait for usability reasons
