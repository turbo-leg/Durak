# Durak Game - Terminology & Events Reference

## Core Game Terminology

### Players & Roles

| Term | Definition |
|------|-----------|
| **Attacker** | The active player playing cards onto the table during a round |
| **Defender** | The player being attacked, who must beat/cover the attacker's cards |
| **First Attacker** | The player who starts attacking in a new round (leads the round) |
| **Fool/Durak** | The player who loses the game (cannot defend and must pick up all cards) |
| **Huzur (Trump)** | The designated trump suit for the game (bottom card of the deck) |

### Game Phases

| Phase | Description |
|-------|-------------|
| **Waiting** | Lobby phase where players join and ready up before game starts |
| **Playing** | Active game phase where attacks, defenses, and turns occur |
| **Finished** | Game is over; one player remains (the Durak) |

### Card & Table Concepts

| Term | Definition |
|------|-----------|
| **Pair** | An attack card and its corresponding defense card (or empty slot awaiting defense) |
| **Table Cards** | All card pairs currently on the table in play |
| **Attack Cards** | Cards actively being played against the defender (incoming cards) |
| **Defense Cards** | Cards being played by the defender to beat attack cards |
| **Hand** | Cards currently held by a player |
| **Deck** | Remaining cards in the draw pile |
| **Rank** | Card value (A, 2-10, J, Q, K) |
| **Suit** | Card type (Hearts ♥, Diamonds ♦, Clubs ♣, Spades ♠) |
| **Trump/Huzur Suit** | Special suit that beats all other suits |
| **Joker** | Special card that can beat any other card |

### Round Flow

| Term | Definition |
|------|-----------|
| **Round** | Complete cycle where the attack passes through multiple defenders in clockwise order until everyone defends once or someone picks up |
| **Pair/Stack** | An attack card with its corresponding defense card on the table (max 6 pairs per round) |
| **Untuulah** | Cards that have been successfully beaten and are discarded from play (removed from the table) |
| **Clockwise Defense Cycle** | The core multi-player mechanic: after successful defense, the defender becomes the new attacker and passes to the next player in seat order |
| **Defense Chain** | Sequential progression of defensive positions moving clockwise around the table (tracked by defenseChainCount) |
| **Chain Completion** | When defenseChainCount reaches players.size - 1, meaning every player except the original attacker has defended once |
| **Mass Attack** | When the attacker plays multiple cards (3 or 5) in a single turn that the current defender must beat simultaneously |
| **3-Card Mass** | 3 cards with at least 1 matching pair; allowed if all players have ≥3 cards |
| **5-Card Mass** | 5 cards with at least 2 matching pairs; only allowed when deck is empty and all players have ≥5 cards (in 5-card lobbies) or always (in 7-card lobbies) |

### Game Mechanics

| Term | Definition |
|------|-----------|
| **Beat/Cover** | Defender plays a card equal or higher rank than attacker's card, or any trump; if successful, defender becomes the new attacker and next player in seat order becomes new defender |
| **Pick Up** | Defender gives up and takes all cards from table (both beaten and unbeaten), losing the round; the chain resets and next defender in clockwise order is assigned |
| **Hand Size** | Target number of cards each player should maintain (configurable: 5 or 7) |
| **Replenish** | Draw new cards from deck to restore hand size after round |
| **Win Condition** | Last player with cards remaining is eliminated, previous player wins |
| **Draw Amount** | Number of cards drawn per replenish (max hand size - current hand) |

### Game Modes

| Mode | Description |
|------|-----------|
| **Classic** | Standard 1v1 gameplay with circular player progression |
| **Teams** | Two-team gameplay with team-based win conditions |
| **Manual Team Selection** | Players manually choose teams during lobby |
| **Auto Team Selection** | System automatically balances teams |

---

## Important Game Events

### Client-Side Events (Emitted to Server)

#### Attack Phase
```
"attack" - Player plays attacking cards
  Payload: { cards: Card[] }
  Conditions:
    - Player must be currentTurn (attacker)
    - Cards must be playable (match rank of table cards or be first card)
    - Table must not be full (max 6 cards)
```

#### Defense Phase
```
"defend" - Player plays defense cards against attack
  Payload: { cards: Card[] }
  Conditions:
    - Player must be currentTurn (defender in this context)
    - Cards must beat corresponding attack cards
    - Card must be higher rank OR trump suit OR joker
```

#### Round Completion
```
"pickUp" - Defender takes all cards and round ends
  Payload: (none)
  Triggers:
    - Defender chooses to give up
    - Timer expires for defender (auto-triggered)
    - Defender cannot beat remaining cards
```

#### Card Swap
```
"swapHuzur" - Player exchanges a card with the trump card under deck
  Payload: (none)
  Conditions:
    - Must hold the 7 of trump suit
    - Deck cannot be empty
    - Only available during certain phases
```

#### Team Selection
```
"switchTeam" - Player selects team during lobby
  Payload: { team: 0 | 1 }
  Conditions:
    - Game phase must be "waiting"
    - Game mode must be "teams"
    - Team selection must be "manual"
    - Target team must not be full (balanced)
```

#### Lobby Readiness
```
"toggleReady" - Player signals they are ready to start
  Payload: { isReady: boolean }
  Triggers: Auto-start if room full and all players ready
```

### Server-Side Events (Broadcast to Clients)

#### Game State Changes
```
"stateChange" - Game state synchronized to all clients
  Includes: phase, players, table cards, deck, timer state, etc.
  Frequency: Continuous (Colyseus automatic sync)
```

#### Game Lifecycle
```
"gameStarted" - Game transitions from waiting to playing
  Payload: { phase: "playing" }
  Triggered: All players ready + room full

"gameOver" - Game finishes with winner/loser determination
  Payload: { loser: string | null, draw?: boolean }
  Triggered: Only one player without cards remains

"playerWon" - Individual player eliminated
  Payload: { playerId: string }
  Triggered: Player reaches 0 cards and deck empty
```

#### Round Events
```
"roundStart" - New round begins with assigned attacker and first defender
  Includes: seat order established, cards replenished, chain count reset
  Triggered: Previous round completed

"attackPlayed" - Attacker plays cards against current defender
  Payload: { cards: Card[] }
  Next: Current defender must beat all cards or pick up

"defendPlayed" - Defender successfully beats all attack cards
  Payload: { cards: Card[] }
  Effect: Beaten cards moved to table (untuulah history)
          Defense cards become new active attack cards
          Defender becomes new attacker
          Next player in clockwise order becomes new defender
          defenseChainCount incremented
  Next: New defender must beat new attack cards, or pick up

"chainCompleted" - All players in clockwise order have defended once
  Trigger: defenseChainCount >= players.size - 1
  Effect: All cards on table removed (untuulah)
  Next: Round ends, new round begins

"roundEnd" - Current round concludes
  Triggered: Either (1) chain completed OR (2) defender picked up
  
"defenderPickedUp" - Defender gives up and takes all cards
  Payload: { defenderId: string }
  Effect: Defender takes all cards from table into hand
          Chain resets, round ends
  Next: New round begins
```

#### Turn Events
```
"turnStart" - New player's turn begins as defender
  Payload: { currentTurn: string, turnStartTime: number }
  Sets: Timer countdown (30 seconds default)
  Note: currentTurn = current defender (who receives attacks)

"turnExpired" - Current defender's timer ran out
  Payload: { playerId: string }
  Action: Defender automatically picks up all cards on table
  Effect: Round ends, new round begins

"defenderChanged" - Turn passed to next player in clockwise order
  Payload: { newDefenderId: string }
  Trigger: After successful defense
  Effect: Old defender becomes new attacker, next player becomes new defender
  
"chainProgression" - Defense chain count incremented
  Payload: { chainCount: number, totalPlayers: number }
  Trigger: After each successful defense
```

#### Error Events
```
"error" - Invalid action attempted
  Payload: { message: string }
  Examples:
    - "Cannot switch teams: team full"
    - "Cannot defend: not your turn"
    - "Invalid card: doesn't beat attacker's card"

"info" - Informational message
  Payload: { message: string }
  Examples:
    - "You joined Team Blue"
    - "Waiting for more players"
```

---

## Timer System Events

### Timer State Properties

| Property | Type | Description |
|----------|------|-------------|
| `turnStartTime` | number | Epoch milliseconds when current turn started |
| `turnTimeLimit` | number | Milliseconds allowed per turn (default: 30000) |
| `timeRemaining` | number | Calculated: `turnTimeLimit - (now - turnStartTime)` |

### Timer Events

```
"turnExpired" - Timer countdown reaches zero
  Triggered: Server-side timeout after turnTimeLimit ms
  Handler: handlePickUp() called automatically for defenders
  Client Display: Sand clock (⏳) stops shaking, round ends
```

### Timer Visual Feedback

| Time Remaining | Color | Animation |
|----------------|-------|-----------|
| > 50% (>15s) | 🟢 Green | Static sand clock |
| 25-50% (7.5-15s) | 🟡 Yellow | Static sand clock |
| < 25% (<7.5s) | 🔴 Red | Shaking sand clock |
| 0s | ❌ Expired | Round auto-ends |

---

## Game State Update Events

### When State Changes

| Event | State Fields Updated | Broadcast |
|-------|---------------------|-----------|
| Card played | `tableCards`, `players[].hand`, `deck` | Yes |
| Player joins | `players` | Yes |
| Player leaves | `players`, `seatOrder` | Yes |
| Team selected | `players[].team` | Yes |
| Ready toggled | `players[].isReady` | Yes |
| Turn advances | `currentTurn`, `turnStartTime` | Yes |
| Round ends | `phase`, `winners` | Yes |
| Game finishes | `phase`, `loser` | Yes |

---

## Turn Timing & Enforcement

### Defender Timeout
```
Scenario: Defender doesn't defend within 30 seconds
Result: handlePickUp() called automatically
Server: Defender takes all table cards, round ends
Client: Auto-pickup notification shown
```

### Defense Chain Progression
```
After successful defense:
1. Beaten cards move to table (untuulah history)
2. Defense cards become new active attack cards
3. Defender becomes new attacker
4. Next player in clockwise order becomes new defender
5. defenseChainCount incremented
6. If defenseChainCount >= players.size - 1:
   - All cards removed from table
   - Round ends
   - New round begins
```

---

## Data Flow Events

### Game Initialization
```
1. Client connects → onCreate() on server
2. Client receives initial GameState
3. If waiting phase → show lobby UI
4. If playing phase → show game board
5. Timer syncs via turnStartTime
```

### Turn Sequence
```
1. turnStart: turnStartTime = Date.now()
2. All clients calculate timeRemaining every 100ms
3. Timer decreases 30s → 0s
4. If timeRemaining ≤ 0:
   - Server: handlePickUp() triggered
   - All clients: round ends, next turn starts
```

### Card Sync
```
Client: sends "attack" with Card[]
Server: validates, updates GameState.tableCards
Broadcast: ALL clients receive updated tableCards
Each Client: re-renders table with new cards
```

---

## Team Mode Events

### Team-Specific Events
```
"switchTeam" - Sent by client to server
  Only valid during "waiting" phase in team mode

"teamBalanced" - Informational broadcast
  Sent when teams reach equal player count
  Allows "Start Game" button to activate

"teamImbalanced" - Warning broadcast
  Sent when one team has more players
  May prevent game start depending on rules
```

---

## Session Lifecycle Events

### Join Events
```
"onJoin" - Player successfully joins room
  Server creates Player object
  Adds to gameState.players Map
  Assigns seatOrder if game started

"onLeave" - Player disconnects from room
  Server removes from players Map
  May trigger auto-fill or game end if critical player leaves
```

### Cleanup Events
```
"onDispose" - Room cleaned up (all players left)
  Server: clears all timers
  Clears all event listeners
  Returns resources to pool
```

---

## Summary Table: Important Event Triggers

| Trigger | Event | Effect |
|---------|-------|--------|
| All ready + Full | gameStarted | Transition to playing |
| Attacker plays cards | tableCards updated | Defender must respond |
| Defender plays card | tableCards updated | Attacker can continue or pass |
| Defender gives up | pickUp triggered | Defender loses round |
| Timer expires (attacker) | turnExpired | Pass to next attacker |
| Timer expires (defender) | turnExpired | Auto-pickup, round ends |
| Last card drawn | deck empty | Game approaching end |
| Player reaches 0 cards | playerWon | Remove from play |
| One player remains | gameOver | Final player is Durak |
| Player disconnects | onLeave | Handle missing player |

---

## Key Acronyms & Abbreviations

| Acronym | Meaning |
|---------|---------|
| **A, 2-10, J, Q, K** | Card ranks (Ace, Numbers, Jack, Queen, King) |
| **♥ ♦ ♣ ♠** | Card suits (Hearts, Diamonds, Clubs, Spades) |
| **Tx** | Trump card (T = trump indicator) |
| **ms** | Milliseconds (timer unit) |
| **DoM** | Defender or Multi-attack mode |
| **UX** | User Experience |
| **UI** | User Interface |
| **API** | Application Programming Interface |
