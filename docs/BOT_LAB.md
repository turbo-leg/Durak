# Six-player bot lab

Run from the repository root:

```sh
npm run bot:lab
```

This plays two generations of six-player, five-card free-for-all games. Each policy takes all six seats on the same seeded decks. Seed blocks rotate among tables of the incumbent, original bot, mass-attack specialist, and power-card conserver. Training uses successive halving: all candidates play the first quarter of seeds, the stronger half play to the halfway point, and the strongest few play the full budget. The default run uses up to 20 training seeds per surviving policy and 100 fresh holdout seeds for the finalist. To change the budget or worker count:

```sh
npm run bot:lab -- --seeds=50 --holdout=300 --workers=4
```

Each run advances to a fresh, nonoverlapping seed range. The chosen `seedBase` is printed and saved with the raw result. Pass `--seed-base=4100000` to replay a specific deck batch.

Open `output/bot-lab/report.html` in a browser after the run. The report ranks policies by win rate, shows approximate 95% intervals and seat effects, and records the paired holdout comparison. Raw results are in `output/bot-lab/results.json`; past runs are preserved in `output/bot-lab/runs/` and summarized in `history.json`.

The runner changes `packages/server/src/ai/BotChampion.ts` only when the holdout win-rate difference has a positive 95% lower bound and all tournament games finish without invalid moves or stalls. The hard bot uses that champion automatically. A policy may look best during training but fail the holdout check; then the incumbent stays in place.

Candidates also test a finish-win bonus: when the deck is empty, a legal attack that plays the entire hand wins immediately. The bonus is a policy setting, so the lab measures it against the incumbent on matched decks before adopting it.

Simulations run on the CPU in match worker threads (four by default). Each match uses its own seeded random stream for the deck and bot tie breaks, so worker scheduling does not change results. The GTX 1080 is available for a later batched neural-policy experiment, but these small rule-based decisions do not benefit from CUDA. Every move goes through the same room handlers as a live match; the runner disables only timers, delays, logging, and network broadcasts.

The confidence calculation is an approximate normal interval across deck-seed blocks. Use more holdout seeds for a close promotion decision. A win here means strength against the current hard bot in this six-player mode; it does not establish optimal play or strength against humans.

## One-on-one readiness

Run `npm run bot:duel` for a separate two-player tournament and open `output/bot-duel/report.html`. It uses the same halving schedule and worker pool. Training rotates through the current duel champion, original bot, six-player champion, mass-attack specialist, and power-card conserver. A candidate is promoted only when it beats the duel incumbent on fresh, seat-swapped holdout games with a positive 95% lower bound and wins at least half its games against each stress opponent. The live hard bot selects the duel champion in a two-player classic game; the six-player champion remains separate.

Duel training now uses a bounded reward: +1 for a win or −1 for a loss, plus at most 0.1 for the final hand-size difference and 0.05 for the forced-pickup difference. These small terms help choose which policies receive more training games; a win always outweighs them. The report shows reward and pickups per game. Fresh holdout promotion and the stress checks still use actual wins, so the shaped reward cannot promote a weaker candidate by itself.

Winning bot-vs-bot games cannot establish strength against a specific human. Before inviting a serious 1v1 challenge, also test the duel champion against varied older policies and review its games for exploitable patterns.

During a room, bots also track public response patterns per defender: whether they picked up or defended, attack size and strength, pile size, and the exact defense cards spent. Later attacks are scored against those observations, favoring pressure that previously made that defender pick up or spend stronger cards. This memory stays private to the server room, follows a player across rematches in that room, and does not reveal cards still held.
The duel report shows a conservative bot stress target: the 95% lower bound of the win rate must exceed 55% against each contrasting opponent. This target is a screening rule for an invitation, not a claim about human-level play.

With an empty deck, a player wins as soon as they play their last card. The duel policy now adds finish-threat pressure when the opponent has one or two cards, favoring a legal attack the opponent is unlikely to defend. This uses publicly known cards and hand counts; the opponent's hidden cards remain unknown. An optional benchmark in `packages/server/tests/botThreat.test.ts` compares it with the previous policy on 1,000 fresh, seat-swapped games.

## Self-play learning

Run `npm run bot:selfplay` to train a small duel attack model without human move labels. Each generation tests 16 candidate weight vectors against the existing bot population on shared seeded decks, keeps the strongest candidates, and mutates them for the next generation. The reward is +1 or −1 for the game result, with small final-hand and pickup terms. A saved candidate carries into the next run even if it did not earn promotion.

The default run plays 14,440 complete games: 10,240 training games, 1,000 fresh seat-swapped holdout games, and 3,200 stress games for the candidate and incumbent. Promotion requires at least 500 holdout seed pairs, a positive 95% lower bound for the candidate's win-rate lift, at least 50% wins against each stress opponent, and zero invalid or stalled games. Only then does the runner update `BotLearnedChampion.ts`. The model changes attack ranking in classic duels; legal moves and defense still use the existing engine.

Open `output/bot-selfplay/report.html` to see every candidate, generation winners, holdout, stress opponents, and learned weights. Raw results and previous runs are preserved beside it. The video project and MP4 are in `output/bot-selfplay/video/`. Use `--generations`, `--population`, `--seeds`, `--holdout`, `--workers`, or `--seed-base` to change a run. Keep at least 500 holdout pairs for promotion. Training uses CPU workers; a 10-weight model and room simulation do not benefit from CUDA.

The October 2026 large run used `--generations=8 --population=16 --seeds=8000 --holdout=3000 --workers=5`. It completed 2,057,200 games, including 2,048,000 training games and 6,000 fresh head-to-head holdout games. The learned candidate won 3,093 holdout games to the incumbent's 2,907, an estimated +3.1 percentage-point lift with a +0.75-point 95% lower bound. It met all four stress-opponent thresholds, had no invalid or stalled games, and was installed in `BotLearnedChampion.ts`. The run took about 28.6 minutes. The source change is picked up when the game server loads the updated code.

The large run also corrected two simulator issues: each synthetic room now disables Colyseus's patch and auto-disposal timers, and training, holdout, and stress decks use disjoint seed ranges. The two earlier small self-play runs used an overlapping holdout range, so their holdout estimates should not be used as independent promotion evidence. The large run's seed ranges and full results are recorded in `output/bot-selfplay/results.json`.
