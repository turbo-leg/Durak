import { Room, Client } from "colyseus";
import { GameState, DurakEngine, Card, Player } from "@durak/shared";

export class DurakRoom extends Room<GameState> {
  maxClients = 6;

  onCreate(options: any) {
    this.setState(new GameState());

    // Initialize the deck
    const deck = DurakEngine.createDeck();
    const shuffled = DurakEngine.shuffleDeck(deck);
    shuffled.forEach(card => this.state.deck.push(card));

    // Choose the Huzur (Trump) card
    const huzur = this.state.deck.pop();
    if (huzur) {
      this.state.huzurCard = huzur;
      this.state.huzurSuit = huzur.suit;
      // Put it back at the bottom of the deck (typical Durak rules)
      this.state.deck.unshift(huzur); 
    }

    // Register Handlers
    this.onMessage("attack", (client, message) => this.handleAttack(client, message));
    this.onMessage("defend", (client, message) => this.handleDefend(client, message));
    this.onMessage("pickUp", (client) => this.handlePickUp(client));
    this.onMessage("swapHuzur", (client) => this.handleSwapHuzur(client));
    
    // Allow players to start the game manually
    this.onMessage("startGame", () => {
      // Only start if there are at least 2 players and the game hasn't started yet
      if (this.state.phase !== "playing" && this.state.players.size >= 2) {
        this.startGame();
      }
    });
    
    // Add pass action for attacker
    this.onMessage("pass", (client) => this.handlePass(client));
  }

  onJoin(client: Client, options: any) {
    console.log(client.sessionId, "joined!");
    
    const player = new Player(client.sessionId);
    this.state.players.set(client.sessionId, player);

    // If we have 6 players, start the game automatically if not started
    if (this.state.players.size === 6 && this.state.phase !== "playing") {
      this.startGame();
    }
  }

  onLeave(client: Client, consented: boolean) {
    console.log(client.sessionId, "left!");
    this.state.players.delete(client.sessionId);
  }

  private startGame() {
    this.state.phase = "playing";
    
    // Initial Deal (5 cards each)
    this.state.players.forEach(player => {
      for (let i = 0; i < 5; i++) {
        const card = this.state.deck.pop();
        if (card) player.hand.push(card);
      }
    });

    // Set first attacker: player with the lowest Huzur (Trump) card in hand
    let firstId = Array.from(this.state.players.keys())[0];
    let lowestTrumpRank = Infinity;
    
    this.state.players.forEach((player, id) => {
      player.hand.forEach(card => {
        if (card.suit === this.state.huzurSuit && card.rank < lowestTrumpRank) {
          lowestTrumpRank = card.rank;
          firstId = id;
        }
      });
    });
    
    this.state.currentTurn = firstId;
  }

  private handleAttack(client: Client, message: { cards: any[] }) {
    if (this.state.currentTurn !== client.sessionId) return;
    
    const player = this.state.players.get(client.sessionId)!;
    const cardsToPlay = message.cards.map(c => new Card(c.suit, c.rank, c.isJoker));

    // Validation
    const isMass = cardsToPlay.length > 1;
    if (isMass) {
      const allPlayersArray = Array.from(this.state.players.values());
      if (!DurakEngine.isValidMassAttack(cardsToPlay, allPlayersArray, this.state.deck.length)) {
        client.send("error", "Invalid Mass Attack composition or opponent hand size too small.");
        return;
      }
    }

    // Move cards from hand to active attack
    cardsToPlay.forEach(c => {
      const idx = player.hand.findIndex(hc => hc.suit === c.suit && hc.rank === c.rank);
      if (idx !== -1) {
        player.hand.splice(idx, 1);
        this.state.activeAttackCards.push(c);
      }
    });

    this.checkGameOver();

    // Pass turn to next defender
    this.nextTurn();
  }

  private handleDefend(client: Client, message: { cards: any[] }) {
    if (this.state.currentTurn !== client.sessionId) return;

    const player = this.state.players.get(client.sessionId)!;
    const defendingCards = message.cards.map(c => new Card(c.suit, c.rank, c.isJoker));

    const atkCards = Array.from(this.state.activeAttackCards).filter((c): c is Card => c !== undefined);
    const success = DurakEngine.canDefendMass(defendingCards, atkCards, this.state.huzurSuit);

    if (!success) {
      client.send("error", "Your cards cannot beat the current attack.");
      return;
    }

    // Success! Move defenders from hand to table history
    defendingCards.forEach(c => {
      const idx = player.hand.findIndex(hc => hc.suit === c.suit && hc.rank === c.rank);
      if (idx !== -1) {
        player.hand.splice(idx, 1);
        this.state.table.push(c);
      }
    });

    // Beaten attack cards also move to history
    this.state.activeAttackCards.forEach(c => this.state.table.push(c));
    this.state.activeAttackCards.clear();

    // Increment chain
    this.state.defenseChainCount++;

    if (this.state.defenseChainCount === 5) {
      // 6th person defended! Round is dead.
      DurakEngine.endRound(this.state, null);
      DurakEngine.replenishAll(this.state);
      this.checkGameOver();
      this.nextTurn();
    } else {
      // Move defending cards into the "activeAttack" slot for the next player
      defendingCards.forEach(c => this.state.activeAttackCards.push(c));
      this.checkGameOver(); // They might have played their last card and won before passing turn
      this.nextTurn();
    }
  }
  
  private handlePass(client: Client) {
    // Only the current attacker can optionally pass to the next attacker
    if (this.state.currentTurn !== client.sessionId) return;
    
    // If there is an active defense on the table but current attacker passes adding more cards,
    // we would end the attack phase.
    DurakEngine.endRound(this.state, null);
    DurakEngine.replenishAll(this.state);
    this.checkGameOver();
    
    // Next player starts fresh
    this.nextTurn();
  }

  private handlePickUp(client: Client) {
    if (this.state.currentTurn !== client.sessionId) return;
    
    // Use engine to handle pickup logic
    DurakEngine.endRound(this.state, client.sessionId);
    DurakEngine.replenishAll(this.state);
    this.checkGameOver();

    // Next player starts fresh
    this.nextTurn();
  }

  private handleSwapHuzur(client: Client) {
     const player = this.state.players.get(client.sessionId)!;
     const success = DurakEngine.swapHuzur(player, this.state.huzurCard, this.state.huzurSuit, this.state.deck.length);
     if (!success) {
       client.send("error", "You do not have the 7 of Huzur.");
     }
  }

  private checkGameOver() {
    if (this.state.phase !== "playing") return;

    // A player wins if the deck is empty and they have no cards left
    // We check every player
    let hasNewWinner = false;
    this.state.players.forEach((player, id) => {
      // check if player already in winners list
      const alreadyWon = this.state.winners.includes(id);
      
      if (this.state.deck.length === 0 && player.hand.length === 0 && !alreadyWon) {
        this.state.winners.push(id);
        hasNewWinner = true;
        this.broadcast("playerWon", id);
      }
    });

    if (hasNewWinner) {
      // Are there any players left who haven't won?
      const remainingPlayers = Array.from(this.state.players.keys()).filter(
        id => !this.state.winners.includes(id)
      );

      if (remainingPlayers.length <= 1) {
        this.state.phase = "finished";
        if (remainingPlayers.length === 1) {
          this.state.loser = remainingPlayers[0];
          this.broadcast("gameOver", { loser: this.state.loser });
        } else {
          // It's a draw (multi-person win on last beat)
          this.broadcast("gameOver", { loser: null, draw: true });
        }
      }
    }
  }

  private nextTurn() {
    if (this.state.phase === "finished") return;

    const allIds = Array.from(this.state.players.keys());
    let currentIdx = allIds.indexOf(this.state.currentTurn);
    if (currentIdx === -1) currentIdx = 0;

    let nextIdx = (currentIdx + 1) % allIds.length;
    let fallbackCounter = 0;
    
    while (this.state.winners.includes(allIds[nextIdx])) {
      nextIdx = (nextIdx + 1) % allIds.length;
      fallbackCounter++;
      if (fallbackCounter > allIds.length) break; // Should not happen if phase isn't finished but safe
    }
    
    this.state.currentTurn = allIds[nextIdx];
  }
}
