# Durak Game Rules & Conventions (Source of Truth)

> **AI Instruction:** This game uses a highly customized "Hot Potato" progression system with custom deck, mass-attack rules, and hand replenishment logic. NEVER assume standard Durak rules. ALWAYS read this file before modifying `DurakEngine.ts`, `GrandmasterBot.ts`, or any game logic. This is a SINGLE-PLAYER game mode variant with a 42-card deck and no fixed hand size.

## 1. The Deck & Card Values

- **Deck Size**: 42 cards.
- **Suits**: Spades, Hearts, Diamonds, Clubs.
- **Ranks (Low to High)**: 7, 8, 9, 10, J, Q, K, 3, 2, Ace (A=16). Notice that 3, 2, and Ace are the highest standard cards.
- **Jokers**:
  - **Black Joker** (Value 17): Acts as a Spades trump.
  - **Red Joker** (Value 18): The highest card in the game. Acts as a Hearts trump.

## 2. Game Setup & Huzur (Trump)

- **Target Hand Size**: Configurable at game creation (typically 5 or 7 cards). Players maintain this size throughout the game by drawing from the deck.
- **Dealing**: Each player is dealt up to `targetHandSize` cards from the shuffled deck. The dealing order is: Player 1 gets 1 card, Player 2 gets 1 card, ..., Player N gets 1 card, then repeat until each player has `targetHandSize` cards.
- **The Huzur**: The bottom card of the deck is turned face up. Its suit determines the trump suit (`huzurSuit`). This card stays in the deck.
- **First Turn**: Each player draws a random card from a separate deck. The player that drew the highest card gets to go first. In Team mode, 1 player from each team draws a card and the winning team decides who goes first.
- **Swapping the Huzur**:
  - A player holding the **7 of the Trump suit** can swap it with the face-up Huzur.
  - If the Huzur is a Joker, a player holding the **Ace of Spades** can swap it.
  - _Restriction_: A player CANNOT swap using a card they acquired by "picking up" from the table in a previous round. They must have drawn it naturally from the deck (`hasPickedUp` flag blocks this).

## 3. "Hot Potato" Turn Progression (Clockwise)

This game operates in a continuous circle (clockwise direction):

1. **Player A** initiates an attack (single card or mass attack). Turn passes to Player B (next player clockwise).
2. **Player B** must defend against Player A's cards. If successful, Player B's defending cards become the _new_ attack cards.
3. Turn passes to **Player C** (next player clockwise), who must now beat Player B's defense cards.
4. **Successful Round End**: This continues clockwise until it reaches the player on the **right** of the person who started the attack (i.e., the player immediately before the attacker in clockwise order). If that player successfully defeats the stack, they:
   - Put the entire stack into the discard pile (`bita`)
   - Start a brand new attack (single or mass)
   * _Example (4 players, clockwise P1 → P2 → P3 → P4 → P1)_:
     - P1 attacks with 1 card
     - P2 defends and P1's card becomes P2's new attack
     - P3 defends and P2's card becomes P3's new attack
     - P4 defends and P3's card becomes P4's new attack
     - P4 is the player on the right of P1 (attacker). If P4 successfully defeats, the table is cleared and P4 starts the next attack.

## 4. Attacking Types

When initiating an attack, a player can play either a **Single Card** or a **Mass Attack**.

- **Single Card**: Play exactly 1 card.
- **Mass Attacks**: Must contain exactly N cards with at least floor(N/2) pairs of cards with the same rank.
  - **3-Card Mass** (1 Pair + 1 Random card):
    - **Standard max while the deck is intact** (has cards remaining).
    - **Always allowed if targetHandSize >= 3**.
  - **5-Card Mass** (2 Pairs + 1 Random card):
    - **In targetHandSize = 5 lobbies**: ONLY allowed if the deck is empty AND all defending players have >= 5 cards in hand.
    - **In targetHandSize = 7 lobbies**: Always allowed (deck intact or empty).
  - **7-Card Mass** (3 Pairs + 1 Random card):
    - **In targetHandSize = 7 lobbies**: ONLY allowed if the deck is empty AND all defending players have >= 7 cards in hand.
    - **Not applicable in targetHandSize = 5 lobbies**.
  - **7+ Card Masses** are not defined in the current implementation.

## 5. Defending Mechanics

- To defend, a player must assign one card from their hand to beat each incoming active attacking card (`1-to-1` matching).
- A card beats another if:
  - It is a **Joker** (beats everything except a higher Joker; Red Joker beats Black Joker).
  - It is of the **same suit** as the attacker's card and has a **higher rank**.
  - It is a **trump** (Huzur suit) beating a non-trump card.

## 6. Picking Up & Hand Replenishment

- **Picking Up**: If a player cannot or chooses not to defend, they must pick up **ALL** cards on the table. The round ends. The turn passes to the **player sitting to their left** (the next player clockwise), who starts a brand new attack (single or mass).
  - _Example (4 players, clockwise P1 → P2 → P3 → P4)_:
    - P1 attacks
    - P2 defends
    - P3 defends P2
    - P4 cannot defeat P3 and picks up the whole stack (cards from P1, P2, and P3)
    - P1 (sitting to the left of P4, clockwise) gets to start the next attack.
  - **hasPickedUp Flag**: When a player picks up, they are marked with `hasPickedUp = true`.
- **Hand Replenishment (Drawing)**:
  - Players normally draw cards at the end of each attack/defense action to maintain their `targetHandSize`.
  - **Special rule**: Once a player picks up (`hasPickedUp = true`), they stop drawing from the deck **until their hand falls below targetHandSize again**.
  - When replenishing, the number of cards drawn is: `Math.min(deckSize, targetHandSize - player.hand.length)`.

## 7. Winning & Escaping the Game

- **Goal**: Reach 0 cards when the deck is empty.
