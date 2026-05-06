# Development Progress

## Current Focus

- **Branch**: `feat/discord-auto-lobby`
- **Status**: Setting up accurate game rules documentation and preparing bot implementation

## Completed

1. ✅ MongoDB integration for game logging (GameLog schema, saving matches)
2. ✅ Docker environment variables fix (`.env` passed to server container)
3. ✅ Accurate `GAME_RULES.md` extraction from codebase
   - 42-card deck (7-A + 2 Jokers, no 4-5-6)
   - Hot Potato clockwise progression
   - Configurable targetHandSize (5 or 7, NOT fixed 6)
   - Mass attack rules: 3-card (1 pair) or 5-card (2 pairs) depending on deck/hand size
   - Drawing/replenishment with `hasPickedUp` flag logic

## Next Steps

1. Wire up `getLegalMoves()` in `GrandmasterBot.ts` using `DurakEngine` methods
2. Implement valid card/mass attack generation based on current game state
3. Integrate MCTS with custom Hot Potato turn progression
4. Test bot against itself and human players

## Known Issues

- `GrandmasterBot.ts` currently has placeholder `getLegalMoves()` returning only "pickup" move
- Bot needs to understand custom mass attack validation
- MCTS needs adaptation for continuous Hot Potato mechanic (not single attacker vs defender)

## Key Architectural Decisions

- **Game Rules Source of Truth**: `GAME_RULES.md` (read before any engine modifications)
- **Card Values**: Black Joker=17, Red Joker=18, Ace=16, rest standard
- **No standard Durak assumptions**: This is a heavily customized variant
- **Single-mode by default**: "classic" mode (teams mode exists but secondary)

## Context Preservation Tips

- Commit frequently with descriptive messages
- Update this file before switching between development environments
- Reference `GAME_RULES.md` and git history for context
