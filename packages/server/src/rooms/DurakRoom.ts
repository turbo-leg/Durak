import { Room, Client } from "colyseus";
import { GameState, DurakEngine, Card, Player } from "@durak/shared";

export class DurakRoom extends Room<GameState> {
  maxClients = 6;

  onCreate(options: any) {
    this.setState(new GameState());

    // Apply custom options
    this.state.maxPlayers = options.maxPlayers ? parseInt(options.maxPlayers, 10) : 6;
    this.maxClients = this.state.maxPlayers;

    this.state.isPrivate = !!options.isPrivate;
    this.setPrivate(this.state.isPrivate);

    if (options.mode) {
      this.state.mode = String(options.mode);
    } // "classic" | "teams" etc. (defaults to "classic" in GameState)

    if (options.teamSelection) {
      this.state.teamSelection = String(options.teamSelection);
    }
    
    if (options.handSize) {
      this.state.targetHandSize = parseInt(options.handSize, 10);
    }

    this.setMetadata({ mode: this.state.mode, discordInstanceId: options.discordInstanceId || null });

    // Initialize the deck
    const deck = DurakEngine.createDeck();
    let shuffled;
    if (options.testModeDeck) {
      shuffled = options.testModeDeck;
    } else {
      shuffled = DurakEngine.shuffleDeck(deck);
    }
    shuffled.forEach((card: Card) => this.state.deck.push(card));

    // Choose the Huzur (Trump) card
    const huzur = this.state.deck.pop();
    if (huzur) {
      // In Colyseus, you cannot put the exact same Schema instance in two places.
      // So we clone the huzur to serve as the visual Trump card underneath the deck.
      const clonedHuzur = new Card(huzur.suit, huzur.rank, huzur.isJoker);
      this.state.huzurCard = clonedHuzur;
      this.state.huzurSuit = huzur.suit;

      // Put original back at the bottom of the deck
      this.state.deck.unshift(huzur);
    }

    // Register Handlers
    this.onMessage("attack", (client, message) => this.handleAttack(client, message));
    this.onMessage("defend", (client, message) => this.handleDefend(client, message));
    this.onMessage("pickUp", (client) => this.handlePickUp(client));
    this.onMessage("swapHuzur", (client) => this.handleSwapHuzur(client));

    // Team selection handler in lobby
    this.onMessage("switchTeam", (client, message) => {
      if (this.state.phase === "waiting" && this.state.mode === "teams" && this.state.teamSelection === "manual") {
        const player = this.state.players.get(client.sessionId);
        if (player && typeof message.team === "number") {
          const targetTeam = message.team === 1 ? 1 : 0;
          const team0Count = Array.from(this.state.players.values()).filter((p) => p.team === 0).length;
          const team1Count = Array.from(this.state.players.values()).filter((p) => p.team === 1).length;
          const half = this.state.maxPlayers / 2;

          // Don't allow overfilling a team pre-start.
          if (targetTeam === 0 && team0Count >= half) {
            client.send("error", `Team Blue is full. Teams must stay balanced (${half} vs ${half}).`);
            return;
          }
          if (targetTeam === 1 && team1Count >= half) {
            client.send("error", `Team Red is full. Teams must stay balanced (${half} vs ${half}).`);
            return;
          }

          player.team = targetTeam;
          client.send("info", `You joined ${targetTeam === 0 ? "Team Blue" : "Team Red"}.`);
        }
      }
    });

    // Allow players to ready up manually
    this.onMessage("toggleReady", (client, message) => {
      const player = this.state.players.get(client.sessionId);
      if (player) {
        player.isReady = message.isReady;

        // Auto start if room is full and everyone is ready
        if (
          this.state.phase !== "playing" &&
          this.state.players.size === this.state.maxPlayers &&
          Array.from(this.state.players.values()).every((p) => p.isReady)
        ) {
          // Teams balance enforcement (manual selection)
          if (this.state.mode === "teams" && this.state.teamSelection === "manual") {
            const team0Count = Array.from(this.state.players.values()).filter((p) => p.team === 0).length;
            const team1Count = Array.from(this.state.players.values()).filter((p) => p.team === 1).length;
            if (team0Count !== team1Count) {
              // Broadcast so everyone sees why the game didn't start.
              this.broadcast(
                "error",
                `Teams must be balanced to start: Team Blue (${team0Count}) vs Team Red (${team1Count}).`
              );
              return;
            }
          }

          this.startGame();
        }
      }
    });

    // Add pass action for attacker
    this.onMessage("pass", (client) => this.handlePass(client));
  }

  onJoin(client: Client, options: any) {
    console.log(client.sessionId, "joined!");

    const player = new Player(client.sessionId);
    // Auto-ready for bots or special logic can go here. By default false.
    this.state.players.set(client.sessionId, player);

    // We no longer auto-start just because the room is full.
    // They must click Ready.
  }

  onLeave(client: Client, consented: boolean) {
    console.log(client.sessionId, "left!");
    this.state.players.delete(client.sessionId);
  }

  private startGame() {
    this.state.phase = "playing";

    // Assign teams and seat order
    const sessionIds = Array.from(this.state.players.keys());
    let teamA = 0;
    let teamB = 0;

    if (this.state.mode === "teams") {
      const sortedIds = sessionIds.sort(); // Optional sorting for consistency

      if (this.state.teamSelection === "manual") {
        // Separate players into their chosen teams
        const team0 = sortedIds.filter((id) => this.state.players.get(id)!.team === 0);
        const team1 = sortedIds.filter((id) => this.state.players.get(id)!.team === 1);

        // Seat them alternatingly
        const maxLength = Math.max(team0.length, team1.length);
        for (let i = 0; i < maxLength; i++) {
          if (i < team0.length) this.state.seatOrder.push(team0[i]);
          if (i < team1.length) this.state.seatOrder.push(team1[i]);
        }
      } else {
        // In random teams mode, alternate players into teams 0 and 1
        let currentIndex = 0;
        sortedIds.forEach((id) => {
          const p = this.state.players.get(id)!;
          p.team = currentIndex % 2;
          this.state.seatOrder.push(id);
          currentIndex++;
        });
      }
    } else {
      // Normal classic free for all
      sessionIds.forEach((id) => {
        const p = this.state.players.get(id)!;
        p.team = 0; // default for FFA
        this.state.seatOrder.push(id);
      });
    }

    // Initial Deal (Dynamic targetHandSize cards each)
    this.state.players.forEach((player) => {
      for (let i = 0; i < this.state.targetHandSize; i++) {
        const card = this.state.deck.pop();
        if (card) player.hand.push(new Card(card.suit, card.rank, card.isJoker));
      }
    });

    // Set first attacker: player with the lowest Huzur (Trump) card in hand
    let firstId = Array.from(this.state.players.keys())[0];
    let lowestTrumpRank = Infinity;

    this.state.players.forEach((player, id) => {
      player.hand.forEach((card) => {
        if (card.suit === this.state.huzurSuit && card.rank < lowestTrumpRank) {
          lowestTrumpRank = card.rank;
          firstId = id;
        }
      });
    });

    this.state.currentTurn = firstId;
  }

  private getPreviousTurn(currentTurnId: string): string {
    const ids = Array.from(this.state.seatOrder); // USE SEATORDER NOW
    const idx = ids.indexOf(currentTurnId);
    if (idx === -1) return currentTurnId;
    const prevIdx = (idx - 1 + ids.length) % ids.length;
    return ids[prevIdx] || currentTurnId;
  }

  private nextTurn() {
    // For passing turn to next defender
    const ids = Array.from(this.state.seatOrder);
    const idx = ids.indexOf(this.state.currentTurn);
    if (idx !== -1) {
      const nextId = ids[(idx + 1) % ids.length];
      if (nextId) this.state.currentTurn = nextId;
    }
  }

  private handleAttack(client: Client, message: { cards: any[] }) {
    if (this.state.currentTurn !== client.sessionId) return;

    const player = this.state.players.get(client.sessionId)!;
    const cardsToPlay = message.cards.map((c) => new Card(c.suit, c.rank, c.isJoker));

    // Validation
    const isMass = cardsToPlay.length > 1;
    if (isMass) {
      const allPlayersArray = Array.from(this.state.players.values());
      if (!DurakEngine.isValidMassAttack(cardsToPlay, allPlayersArray, this.state.deck.length, this.state.targetHandSize)) {
        client.send("error", "Invalid Mass Attack composition or opponent hand size too small.");
        return;
      }
    } else if (this.state.table.length > 0 || this.state.activeAttackCards.length > 0) {
      // Adding to an ongoing attack: the rank must match something on the table or active attacks
      const playedRank = cardsToPlay[0].rank;
      const rankExists =
        this.state.table.some((c) => c.rank === playedRank) ||
        this.state.activeAttackCards.some((c) => c.rank === playedRank);

      if (!rankExists && !cardsToPlay[0].isJoker) {
        client.send("error", "You can only attack with a rank that is already on the table.");
        return;
      }
    }

    // Move cards from hand to active attack
    cardsToPlay.forEach((c) => {
      const idx = player.hand.findIndex((hc) => hc.suit === c.suit && hc.rank === c.rank);
      if (idx !== -1) {
        player.hand.splice(idx, 1);
        this.state.activeAttackCards.push(c);
      }
    });

    this.checkGameOver();

    // User rule: players should always draw a card immediately after they play anything.
    DurakEngine.replenishAll(this.state);

    // Pass turn to next defender
    this.nextTurn();
  }

  private handleDefend(client: Client, message: { cards: any[] }) {
    if (this.state.currentTurn !== client.sessionId) return;

    const player = this.state.players.get(client.sessionId)!;
    const defendingCards = message.cards.map((c) => new Card(c.suit, c.rank, c.isJoker));

    const atkCards = Array.from(this.state.activeAttackCards).filter((c): c is Card => c !== undefined);
    const success = DurakEngine.canDefendMass(defendingCards, atkCards, this.state.huzurSuit);

    if (!success) {
      client.send("error", "Your cards cannot beat the current attack.");
      return;
    }

    // Success! Move defenders from hand to table history paired with attack cards.
    // To ensure they are displayed with the attacked card underneath, 
    // we push the Attack Card first, then the Defending Card.
    for (let i = 0; i < defendingCards.length; i++) {
      const defCard = defendingCards[i];
      const idx = player.hand.findIndex((hc) => hc.suit === defCard.suit && hc.rank === defCard.rank);
      if (idx !== -1) {
        player.hand.splice(idx, 1);

        // Colyseus arrays shouldn't share references directly across state structures
        const originalAtk = atkCards[i];
        const clonedAtk = new Card(originalAtk.suit, originalAtk.rank, originalAtk.isJoker);

        this.state.table.push(clonedAtk); // Attack card on bottom
        this.state.table.push(defCard);     // Defense card on top
      }
    }

    // Since we pushed active attacks as clones, clear the originals fully by splicing
    this.state.activeAttackCards.splice(0, this.state.activeAttackCards.length);

    // Increment chain
    this.state.defenseChainCount++;

    if (this.state.defenseChainCount >= this.state.players.size - 1) {
      // Everyone defended! Round is dead.
      DurakEngine.endRound(this.state, null);
      DurakEngine.replenishAll(this.state);
      this.checkGameOver();

      // Because this is the defender's turn (they just played their card), passing it to nextTurn
      // would skip them! But since they successfully beat all attacks, they should be the next attacker!
      // But wait! `handleAttack` passes the turn to the defender immediately. So right now, currentTurn is the defender!
      // We don't want to skip them, so we just keep the turn on them so they can attack!
    } else {
      // Allow the attacker to throw in more cards instead of forcing the defender's defense to be a new attack.
      this.state.currentTurn = this.getPreviousTurn(client.sessionId);

      // We don't draw yet (drawing happens at endRound). 
      this.checkGameOver(); 
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
     const success = DurakEngine.swapHuzur(player, this.state);
     if (!success) {
       client.send("error", "Cannot swap Huzur. You need the 7 of trump, and the deck cannot be empty.");
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
}
