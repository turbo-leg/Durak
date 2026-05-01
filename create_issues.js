const { execSync } = require('child_process');

const labels = [
  { name: 'alpha', color: '1D76DB', description: 'Milestone: Alpha' },
  { name: 'beta', color: 'E99695', description: 'Milestone: Beta' },
  { name: 'rc', color: 'F9D0C4', description: 'Milestone: Release Candidate' },
  { name: 'ci/cd', color: 'BFDADC', description: 'CI/CD and deployment' },
  { name: 'testing', color: 'C2E0C6', description: 'Test coverage' },
  { name: 'game-logic', color: 'D4C5F9', description: 'Engine and room logic' },
  { name: 'ui/ux', color: 'FEF2C0', description: 'Frontend and design' },
  { name: 'discord', color: '5865F2', description: 'Discord integration' },
  { name: 'ai', color: 'F9A825', description: 'OpenAI-powered AI bots' },
  { name: 'infra', color: 'B4A7D6', description: 'Infrastructure and scaling' },
  { name: 'meta-game', color: 'FBCA04', description: 'Profiles, ELO, achievements' },
  { name: 'security', color: 'E11D48', description: 'Security audit' },
];

console.log('Creating labels...');
for (const label of labels) {
  try {
    execSync(
      `gh label create "${label.name}" --color "${label.color}" --description "${label.description}" --force`,
      { stdio: 'pipe' },
    );
    console.log(`Label created/updated: ${label.name}`);
  } catch (e) {
    console.error(`Failed to create label: ${label.name}`);
  }
}

const issues = [
  // Alpha
  {
    title: 'Expand CI to run tests and type-check on every PR',
    body: '- Uncomment test step in `ci.yml`\n- Add `tsc --noEmit` type-check step for client + server\n- Add build step (`npm run build:client`)\n- Cache `node_modules` properly',
    labels: ['alpha', 'ci/cd'],
  },
  {
    title: 'Add deploy-on-merge pipeline (Fly.io)',
    body: '- New workflow `deploy.yml`: triggers on push to `main`\n- Runs `flyctl deploy` with secrets\n- Includes health check after deploy',
    labels: ['alpha', 'ci/cd'],
  },
  {
    title: 'Add PR status checks (block merge on failure)',
    body: '- Require CI to pass before merge\n- Add branch protection rules to `main`',
    labels: ['alpha', 'ci/cd'],
  },
  {
    title: 'Server integration tests for DurakRoom',
    body: '- Test `handleAttack` / `handleDefend` / `handlePickUp` end-to-end via Colyseus test utilities\n- Verify state mutations match expected outcomes\n- Test timer expiry → auto-pickup behavior\n- Relates to existing #106',
    labels: ['alpha', 'testing'],
  },
  {
    title: 'Full game replay regression tests',
    body: '- Create deterministic game replays from action logs (the user already pastes these)\n- Parse action log format and replay through engine\n- Assert card conservation invariant at every step',
    labels: ['alpha', 'testing'],
  },
  {
    title: 'Client component tests (React Testing Library)',
    body: '- Test `Lobby.tsx`: team selection, ready toggle, start conditions\n- Test `GameBoard.tsx`: card selection, attack/defend button state\n- Test `Card.tsx`: rendering with all rank/suit combinations',
    labels: ['alpha', 'testing'],
  },
  {
    title: 'Fix timer synchronization',
    body: '- Server broadcasts `turnStartTime` using monotonic timestamps\n- Client computes remaining time using ping-adjusted offset\n- Timer bar animates smoothly without jumps\n- Resolves #97',
    labels: ['alpha', 'game-logic'],
  },
  {
    title: 'Handle player disconnect during active turn',
    body: '- If current-turn player disconnects, auto-pickup after 5s grace period\n- If non-current player disconnects, skip them in seat order\n- Implement `allowReconnection(client, 30)` for 30-second rejoin window\n- Resolves #105',
    labels: ['alpha', 'game-logic'],
  },
  {
    title: 'Implement "suhuh" first-turn card draw',
    body: '- Each player draws 1 card from separate deck\n- Highest card determines first attacker\n- In teams mode: 1 draw per team, winning team picks starter\n- Resolves #104',
    labels: ['alpha', 'game-logic'],
  },
  {
    title: 'Fix defense snapshot visibility',
    body: '- After a successful defense, show the attack+defense pairing for 5-10 seconds\n- Ensure `defensePlayed` broadcast reaches all clients reliably\n- Clear snapshot state on next action\n- Resolves #80',
    labels: ['alpha', 'game-logic', 'ui/ux'],
  },
  {
    title: 'Validate 7-card mass attack rules',
    body: '- In `targetHandSize=7` lobbies, allow 7-card mass (3 pairs + 1 random)\n- Only when deck empty AND all defenders have >=7 cards\n- Add engine method + tests',
    labels: ['alpha', 'game-logic'],
  },
  {
    title: 'End-to-end Discord Activity flow',
    body: '- Test `discordAuth.ts` -> token exchange -> Colyseus room join\n- Wire Discord user identity (username + avatar) to Player state\n- Show Discord avatars in lobby and game board',
    labels: ['alpha', 'discord'],
  },
  {
    title: 'Discord auto-lobby',
    body: '- When Activity launches in a voice channel, auto-create/join a room scoped to that channel\n- Use `discordInstanceId` from SDK for room filtering\n- Handle multiple Activities in the same guild\n- Resolves #69',
    labels: ['alpha', 'discord'],
  },

  // Beta
  {
    title: 'Build game state serializer for LLM prompts',
    body: '- Serialize `GameState` into a structured text prompt: hand, table, active attacks, trump, deck size, seat order\n- Include `GAME_RULES.md` as system context so the LLM understands the custom card hierarchy\n- Format legal moves as enumerated options for the LLM to pick from\n- Add `OPENAI_API_KEY` to server `.env` and Fly.io secrets\n- Resolves #35, #108',
    labels: ['beta', 'ai'],
  },
  {
    title: 'Implement OpenAI bot service (OpenAIBot.ts)',
    body: '- Server-side service that calls OpenAI Chat Completions API (e.g. `gpt-4o-mini` for speed/cost)\n- Sends game state prompt -> receives structured JSON response with chosen move\n- Parse and validate response against `DurakEngine` legal move checks\n- Fallback: if LLM returns invalid move, pick a random valid move\n- Rate limit: queue bot decisions to avoid API cost spikes',
    labels: ['beta', 'ai'],
  },
  {
    title: 'Integrate bot into DurakRoom turn loop',
    body: "- When it's a dummy player's turn, invoke `OpenAIBot.think()` instead of waiting for client input\n- Add configurable delay (1-3s) before bot plays to feel human-like\n- Bot auto-picks up if no valid defense exists\n- Bot respects mass attack rules when attacking",
    labels: ['beta', 'ai'],
  },
  {
    title: 'Bot difficulty via model/temperature tuning',
    body: '- Easy: `gpt-4o-mini` with high temperature (0.9) - makes suboptimal, varied moves\n- Hard: `gpt-4o` with low temperature (0.2) - plays strategically with full rule context\n- Optional: include game history in prompt for hard mode (so bot "remembers" what was played)',
    labels: ['beta', 'ai'],
  },
  {
    title: 'Remove legacy AI stubs',
    body: '- Delete or archive `GrandmasterBot.ts`, `MCTS.ts`, `InferenceEngine.ts`\n- Replace with `OpenAIBot.ts` as the single AI implementation',
    labels: ['beta', 'ai'],
  },
  {
    title: 'Card animations',
    body: '- Dealing animation (cards fly from deck to hands)\n- Attack animation (card slides to table)\n- Defense animation (card overlays attacker)\n- Pickup animation (table cards fly to player)\n- Discard animation (cards fade to bita pile)\n- Resolves #54',
    labels: ['beta', 'ui/ux'],
  },
  {
    title: 'Sound effects',
    body: '- Card play sound\n- Pickup sound\n- Timer warning sound (last 5 seconds)\n- Victory/defeat jingle',
    labels: ['beta', 'ui/ux'],
  },
  {
    title: 'Mobile-responsive layout',
    body: '- Touch-friendly card selection (tap, not hover)\n- Responsive card sizing for small screens\n- Scrollable hand for large hands\n- Portrait and landscape support',
    labels: ['beta', 'ui/ux'],
  },
  {
    title: 'Rematch flow',
    body: '- After game over, show "Rematch?" button\n- If all players accept, reset room state and re-deal\n- If not, return to lobby\n- Resolves #79',
    labels: ['beta', 'ui/ux', 'game-logic'],
  },
  {
    title: 'Spectator mode',
    body: '- Allow joining a full room as spectator\n- Read-only view of game state\n- Chat participation',
    labels: ['beta', 'ui/ux', 'game-logic'],
  },
  {
    title: 'Implement Colyseus reconnection',
    body: '- `allowReconnection(client, 60)` in `onLeave`\n- Client-side auto-reconnect with exponential backoff\n- Restore hand state and UI position on rejoin\n- Show "Player reconnecting..." indicator to others',
    labels: ['beta', 'game-logic'],
  },
  {
    title: 'Rate limiting and input validation',
    body: '- Throttle message handlers (max 10 actions/second per client)\n- Validate all incoming card payloads (no fabricated cards)\n- Sanitize all string inputs',
    labels: ['beta', 'security'],
  },
  {
    title: 'Consolidate draw/logging logic',
    body: '- Create `drawAndLog()` helper that handles both card draw and action log entry\n- Eliminate duplicate draw-log patterns across handleAttack/handleDefend/handlePickUp\n- Resolves #107',
    labels: ['beta', 'game-logic'],
  },

  // RC
  {
    title: 'Redis integration for Colyseus',
    body: '- Add `@colyseus/redis-driver` and `@colyseus/redis-presence`\n- Configure in `index.ts` with `REDIS_URL` env var\n- Enable horizontal scaling across multiple server instances\n- Resolves #52',
    labels: ['rc', 'infra'],
  },
  {
    title: 'Load balancer setup',
    body: '- Add Nginx or Fly.io proxy config for WebSocket sticky sessions\n- Update `docker-compose.yml` for multi-instance local dev\n- Health check endpoints\n- Resolves #53',
    labels: ['rc', 'infra'],
  },
  {
    title: 'Monitoring and alerting',
    body: '- Add `/health` endpoint returning server status, room count, player count\n- Integrate with Fly.io metrics or external monitoring (UptimeRobot)\n- Log structured JSON for aggregation',
    labels: ['rc', 'infra'],
  },
  {
    title: 'Database migration to production',
    body: '- Production MongoDB Atlas setup (or equivalent)\n- Index game logs by roomId, timestamp, players\n- Data retention policy (90 days? forever?)',
    labels: ['rc', 'infra'],
  },
  {
    title: 'Persistent player profiles',
    body: '- Link Discord user ID to player profile document\n- Track total games, wins, losses, durak count\n- Profile page with stats summary\n- Resolves #81',
    labels: ['rc', 'meta-game'],
  },
  {
    title: 'ELO rating system',
    body: '- Implement Elo calculation on game completion\n- Separate ratings for FFA and Teams\n- Display rating in lobby and profile\n- Resolves #82',
    labels: ['rc', 'meta-game'],
  },
  {
    title: 'Match history',
    body: '- Store action logs per game (already done via `GameLog`)\n- Match history page with game replays\n- Filter by player, date, mode\n- Resolves #84',
    labels: ['rc', 'meta-game'],
  },
  {
    title: 'Achievement badges',
    body: '- Define achievement criteria (first win, 10 wins, perfect defense, etc.)\n- Award and display badges on profile\n- Discord notification on achievement unlock\n- Resolves #85',
    labels: ['rc', 'meta-game'],
  },
  {
    title: 'Server-side card validation hardening',
    body: "- Verify every card in `handleAttack`/`handleDefend` actually exists in player's hand\n- Prevent replay attacks (same card played twice)\n- Prevent state manipulation via crafted WebSocket messages",
    labels: ['rc', 'security'],
  },
  {
    title: 'Environment and secrets audit',
    body: '- Verify no secrets in client bundle\n- Rotate Discord client secret\n- Validate `MONGO_URI` and `REDIS_URL` connection strings',
    labels: ['rc', 'security'],
  },

  // Release
  {
    title: 'Full regression test pass',
    body: '- Run all unit, integration, and E2E tests\n- Manual playtest with 6 real players\n- Test all game modes (FFA 2-6 players, Teams 4/6 players, hand sizes 5/7)',
    labels: ['testing'],
  },
  {
    title: 'Discord App Directory submission',
    body: '- Verify all Discord Activity requirements\n- App icon, description, screenshots\n- Privacy policy and terms of service\n- Submit for review',
    labels: ['discord'],
  },
  {
    title: 'Performance benchmarking',
    body: '- Load test with 50+ concurrent rooms\n- Measure WebSocket message latency\n- Profile server memory usage under load',
    labels: ['testing', 'infra'],
  },
];

console.log(`Creating ${issues.length} issues...`);
for (const issue of issues) {
  try {
    const labelsArg = issue.labels.map((l) => `--label "${l}"`).join(' ');
    // use spawnSync for escaping if necessary, but execSync is easier if we escape double quotes
    const escapedTitle = issue.title.replace(/"/g, '\\"');
    const escapedBody = issue.body.replace(/"/g, '\\"').replace(/\$/g, '\\$').replace(/`/g, '\\`');

    execSync(`gh issue create --title "${escapedTitle}" --body "${escapedBody}" ${labelsArg}`, {
      stdio: 'pipe',
    });
    console.log(`Created: ${issue.title}`);
  } catch (e) {
    console.error(`Failed to create issue: ${issue.title}`);
    console.error(e.stderr ? e.stderr.toString() : e.message);
  }
}
