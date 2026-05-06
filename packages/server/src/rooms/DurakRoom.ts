import { Room, Client } from 'colyseus';
import { GameState, DurakEngine, Card, Player } from '@durak/shared';

import { GameLog } from '../models/GameLog';
import mongoose from 'mongoose';

export class DurakRoom extends Room<GameState> {
  maxClients = 6;
  private turnTimeoutId: NodeJS.Timeout | null = null;
  private testModeDeck?: any;

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

    this.setMetadata({
      mode: this.state.mode,
      discordInstanceId: options.discordInstanceId || null,
    });

    this.testModeDeck = options.testModeDeck;

    // Register Handlers
    this.onMessage('attack', (client, message) => this.handleAttack(client, message));
    this.onMessage('defend', (client, message) => this.handleDefend(client, message));
    this.onMessage('pickUp', (client) => this.handlePickUp(client));
    this.onMessage('swapHuzur', (client) => this.handleSwapHuzur(client));
    this.onMessage('ping', (client, message: { clientTime: number }) => {
      client.send('pong', { clientTime: message.clientTime, serverTime: Date.now() });
    });

    // Developer Mode Action Handler
    this.onMessage('dev_action', (client, message) => {
      // NOTE: In a real app, verify process.env.NODE_ENV !== "production"
      if (message.action === 'spawn_dummies') {
        const currentPlayers = this.state.players.size;
        // Default to filling the room to maxPlayers (6)
        const count = message.count || this.state.maxPlayers - currentPlayers;

        let spawned = 0;
        for (let i = 0; i < count; i++) {
          if (this.state.players.size >= this.state.maxPlayers) break;
          const id = `dummy-${Math.random().toString(36).substring(2, 7)}`;
          const p = new Player(id);
          p.isReady = true;

          // Auto-assign teams to keep them balanced in team mode
          if (this.state.mode === 'teams') {
            const team0Count = Array.from(this.state.players.values()).filter(
              (plyr) => plyr.team === 0,
            ).length;
            const team1Count = Array.from(this.state.players.values()).filter(
              (plyr) => plyr.team === 1,
            ).length;
            p.team = team0Count <= team1Count ? 0 : 1;
          }

          this.state.players.set(id, p);
          spawned++;
        }
        this.broadcast(
          'info',
          `Spawned ${spawned} dummy players. Room is at ${this.state.players.size}/${this.state.maxPlayers}`,
        );
      }

      if (message.action === 'play_as') {
        const mockClient = { sessionId: message.asPlayerId, send: () => {} } as unknown as Client;
        if (message.type === 'attack') this.handleAttack(mockClient, { cards: message.cards });
        if (message.type === 'defend') this.handleDefend(mockClient, { cards: message.cards });
        if (message.type === 'pickUp') this.handlePickUp(mockClient);
        if (message.type === 'swapHuzur') this.handleSwapHuzur(mockClient);
      }

      if (message.action === 'force_pass') {
        this.nextTurn();
      }
    });

    // Team selection handler in lobby
    this.onMessage('switchTeam', (client, message) => {
      if (
        this.state.phase === 'waiting' &&
        this.state.mode === 'teams' &&
        this.state.teamSelection === 'manual'
      ) {
        const player = this.state.players.get(client.sessionId);
        if (player && typeof message.team === 'number') {
          const targetTeam = message.team === 1 ? 1 : 0;
          const team0Count = Array.from(this.state.players.values()).filter(
            (p) => p.team === 0,
          ).length;
          const team1Count = Array.from(this.state.players.values()).filter(
            (p) => p.team === 1,
          ).length;
          const half = this.state.maxPlayers / 2;

          // Don't allow overfilling a team pre-start.
          if (targetTeam === 0 && team0Count >= half) {
            client.send(
              'error',
              `Team Blue is full. Teams must stay balanced (${half} vs ${half}).`,
            );
            return;
          }
          if (targetTeam === 1 && team1Count >= half) {
            client.send(
              'error',
              `Team Red is full. Teams must stay balanced (${half} vs ${half}).`,
            );
            return;
          }

          player.team = targetTeam;
          client.send('info', `You joined ${targetTeam === 0 ? 'Team Blue' : 'Team Red'}.`);
        }
      }
    });

    // Update Lobby Settings
    this.onMessage('updateSettings', (client, message) => {
      if (this.state.phase !== 'waiting' || client.sessionId !== this.state.hostId) return;
      if (message.mode) this.state.mode = message.mode;
      if (message.teamSelection) this.state.teamSelection = message.teamSelection;
      if (message.maxPlayers) {
        this.state.maxPlayers = parseInt(message.maxPlayers, 10);
        this.maxClients = this.state.maxPlayers;
      }
      if (message.targetHandSize) this.state.targetHandSize = parseInt(message.targetHandSize, 10);
    });

    // Start Game Manually
    this.onMessage('startGame', (client) => {
      if (client.sessionId !== this.state.hostId) return;

      if (this.state.phase === 'finished') {
        this.resetGameStateForReplay();
        this.startGame();
        return;
      }

      if (this.state.phase !== 'waiting') return;

      const allReady = Array.from(this.state.players.values()).every((p) => p.isReady);
      if (!allReady) {
        client.send('error', 'All players must be ready to start.');
        return;
      }

      // Teams balance enforcement
      if (this.state.mode === 'teams' && this.state.teamSelection === 'manual') {
        const team0Count = Array.from(this.state.players.values()).filter(
          (p) => p.team === 0,
        ).length;
        const team1Count = Array.from(this.state.players.values()).filter(
          (p) => p.team === 1,
        ).length;
        if (team0Count !== team1Count) {
          client.send(
            'error',
            `Teams must be balanced: Blue (${team0Count}) vs Red (${team1Count}).`,
          );
          return;
        }
      }

      this.startGame();
    });

    // Allow players to ready up manually
    this.onMessage('toggleReady', (client, message) => {
      if (this.state.phase !== 'waiting') return;
      const player = this.state.players.get(client.sessionId);
      if (player) {
        player.isReady = message.isReady;
      }
    });
  }

  onJoin(client: Client, options: any) {
    console.log(client.sessionId, 'joined!');

    const player = new Player(client.sessionId);
    if (options.username) player.username = options.username;
    if (options.avatarUrl) player.avatarUrl = options.avatarUrl;

    // First player is host
    if (this.state.players.size === 0) {
      this.state.hostId = client.sessionId;
      player.isReady = true; // Host is ready by default
    }

    this.state.players.set(client.sessionId, player);
  }

  onLeave(client: Client, consented: boolean) {
    console.log(client.sessionId, 'left!');
    this.state.players.delete(client.sessionId);

    // Reassign host if necessary
    if (this.state.hostId === client.sessionId && this.state.players.size > 0) {
      this.state.hostId = this.state.players.keys().next().value || '';
      const newHost = this.state.players.get(this.state.hostId);
      if (newHost) newHost.isReady = true;
    }
  }

  private formatCard(c: Card): string {
    if (c.isJoker) return c.rank === 15 ? 'BJ' : 'RJ';
    const suits: any = { Clubs: 'c', Diamonds: 'd', Hearts: 'h', Spades: 's' };
    let r = c.rank.toString();
    if (c.rank === 11) r = 'J';
    else if (c.rank === 12) r = 'Q';
    else if (c.rank === 13) r = 'K';
    else if (c.rank === 14) r = 'A';
    return `${r}${suits[c.suit] || c.suit.charAt(0).toLowerCase()}`;
  }

  private startGame() {
    this.state.phase = 'playing';
    this.state.seatOrder.splice(0, this.state.seatOrder.length);
    this.state.lastDefenseAt = 0;

    // Initialize the deck right before game starts
    const deck = DurakEngine.createDeck();
    let shuffled = this.testModeDeck ? this.testModeDeck : DurakEngine.shuffleDeck(deck);
    shuffled.forEach((card: Card) => this.state.deck.push(card));

    // Choose the Huzur (Trump) card
    const huzur = this.state.deck.pop();
    if (huzur) {
      const clonedHuzur = new Card(huzur.suit, huzur.rank, huzur.isJoker);
      this.state.huzurCard = clonedHuzur;
      this.state.huzurSuit = huzur.suit;
      this.state.deck.unshift(huzur);
    }

    // Assign teams and seat order
    const sessionIds = Array.from(this.state.players.keys());
    let teamA = 0;
    let teamB = 0;

    if (this.state.mode === 'teams') {
      const sortedIds = sessionIds.sort(); // Optional sorting for consistency

      if (this.state.teamSelection === 'manual') {
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
    this.state.actionLog.push(`ground huzur: ${this.formatCard(this.state.huzurCard)}`);

    this.state.players.forEach((player, id) => {
      const drawnCards: string[] = [];
      for (let i = 0; i < this.state.targetHandSize; i++) {
        const card = this.state.deck.pop();
        if (card) {
          player.hand.push(new Card(card.suit, card.rank, card.isJoker));
          drawnCards.push(`+${this.formatCard(card)}`);
        }
      }
      this.state.actionLog.push(`turn 0: ${id}: ${drawnCards.join(', ')}`);
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
    this.state.turnStartTime = Date.now();

    // Start turn timeout enforcement
    this.startTurnTimer();
  }

  private resetGameStateForReplay() {
    if (this.turnTimeoutId) {
      clearInterval(this.turnTimeoutId);
      this.turnTimeoutId = null;
    }

    this.state.deck.splice(0, this.state.deck.length);
    this.state.discardPile.splice(0, this.state.discardPile.length);
    this.state.table.splice(0, this.state.table.length);
    this.state.tableStacks.splice(0, this.state.tableStacks.length);
    this.state.activeAttackCards.splice(0, this.state.activeAttackCards.length);
    this.state.winners.splice(0, this.state.winners.length);
    this.state.actionLog.splice(0, this.state.actionLog.length);

    this.state.huzurCard = new Card();
    this.state.huzurSuit = '';
    this.state.currentTurn = '';
    this.state.defenseChainCount = 0;
    this.state.phase = 'waiting';
    this.state.turnStartTime = 0;
    this.state.lastDefenseAt = 0;
    this.state.loser = '';

    this.state.players.forEach((player) => {
      player.hand.splice(0, player.hand.length);
      player.pickedUpCardKeys.splice(0, player.pickedUpCardKeys.length);
      player.hasPickedUp = false;
      player.lastDrawLog.splice(0, player.lastDrawLog.length);
    });
  }

  private startTurnTimer() {
    // Clear any existing timer
    if (this.turnTimeoutId) clearInterval(this.turnTimeoutId);

    // Check every 500ms if the current turn has exceeded the time limit
    this.turnTimeoutId = setInterval(() => {
      if (this.state.phase !== 'playing') {
        if (this.turnTimeoutId) clearInterval(this.turnTimeoutId);
        return;
      }

      const elapsed = Date.now() - this.state.turnStartTime;
      if (elapsed > this.state.turnTimeLimit) {
        // Turn has expired - if they're defending, they must pick up
        const currentPlayerId = this.state.currentTurn;
        this.broadcast('turnExpired', { playerId: currentPlayerId });

        // Auto-pickup: the defender (currentTurn) must pick up
        const player = this.state.players.get(currentPlayerId);
        if (player && this.state.activeAttackCards.length > 0) {
          // Force pickup on the defender
          DurakEngine.endRound(this.state, currentPlayerId);
          DurakEngine.replenishAll(this.state);
          this.checkGameOver();
          this.nextTurn();
        }
      }
    }, 500);
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
      if (nextId) {
        this.state.currentTurn = nextId;
        this.state.turnStartTime = Date.now();
        this.startTurnTimer();
      }
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
      if (
        !DurakEngine.isValidMassAttack(
          cardsToPlay,
          allPlayersArray,
          this.state.deck.length,
          this.state.targetHandSize,
        )
      ) {
        client.send('error', 'Invalid Mass Attack composition or opponent hand size too small.');
        return;
      }
    } else if (this.state.table.length > 0 || this.state.activeAttackCards.length > 0) {
      // Adding to an ongoing attack: the rank must match something on the table or active attacks
      const tableCards = Array.from(this.state.table).filter((c): c is Card => !!c);
      const activeAttacks = Array.from(this.state.activeAttackCards).filter((c): c is Card => !!c);
      if (!DurakEngine.isValidAttackAddition(cardsToPlay[0], tableCards, activeAttacks)) {
        client.send('error', 'You can only attack with a rank that is already on the table.');
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

    const playedLog = cardsToPlay.map((c) => `-${this.formatCard(c)}`).join(', ');
    this.state.actionLog.push(`${client.sessionId} attacked: ${playedLog}`);

    this.checkGameOver();

    // User rule: players should always draw a card immediately if they are below target size.
    this.state.players.forEach((p) => {
      const amount = DurakEngine.computeDrawAmount(
        p,
        this.state.deck.length,
        this.state.targetHandSize,
      );
      if (amount > 0) {
        const drawnRaw = this.state.deck.slice(-amount).reverse();
        const drawnFormatted = drawnRaw.map((c) => `+${this.formatCard(c)}`).join(', ');
        this.state.actionLog.push(`${p.id} drew: ${drawnFormatted}`);
      }
    });

    DurakEngine.replenishAll(this.state);

    // Pass turn to next defender
    this.nextTurn();
  }

  private handleDefend(client: Client, message: { cards: any[] }) {
    if (this.state.currentTurn !== client.sessionId) return;

    const player = this.state.players.get(client.sessionId)!;
    const defendingCards = message.cards.map((c) => new Card(c.suit, c.rank, c.isJoker));
    const atkCards = Array.from(this.state.activeAttackCards).filter(
      (c): c is Card => c !== undefined,
    );

    // Use the shared engine logic to find a valid assignment of defenders to attackers
    const assignments = DurakEngine.findDefenseAssignment(
      defendingCards,
      atkCards,
      this.state.huzurSuit,
    );

    if (!assignments) {
      client.send('error', 'Your cards cannot beat the current attack.');
      return;
    }

    // Issue #80: broadcast snapshot of what was defended so the UI can show it for 10 seconds.
    this.broadcast('defensePlayed', {
      at: Date.now(),
      defenderId: client.sessionId,
      attacking: assignments.map((pair) => ({
        suit: pair.atk.suit,
        rank: pair.atk.rank,
        isJoker: pair.atk.isJoker,
      })),
      defending: assignments.map((pair) => ({
        suit: pair.def.suit,
        rank: pair.def.rank,
        isJoker: pair.def.isJoker,
      })),
    });

    // Move resolved attack cards to table (history) and push visual pairs to tableStacks.
    // Defense cards do NOT go to table — they become the new activeAttackCards only.
    assignments.forEach((pair) => {
      // Visual pairing for UI
      this.state.tableStacks.push(new Card(pair.atk.suit, pair.atk.rank, pair.atk.isJoker));
      this.state.tableStacks.push(new Card(pair.def.suit, pair.def.rank, pair.def.isJoker));
      // Attack cards are now resolved history
      this.state.table.push(new Card(pair.atk.suit, pair.atk.rank, pair.atk.isJoker));
    });

    // Clear activeAttackCards (resolved above into table history)
    this.state.activeAttackCards.splice(0, this.state.activeAttackCards.length);

    // The matched defense cards become the NEW activeAttackCards (next player must beat these)
    assignments.forEach((pair) => {
      const defCard = pair.def;
      const idx = player.hand.findIndex(
        (hc) => hc.suit === defCard.suit && hc.rank === defCard.rank,
      );
      if (idx !== -1) {
        player.hand.splice(idx, 1);
        this.state.activeAttackCards.push(new Card(defCard.suit, defCard.rank, defCard.isJoker));
      }
    });

    const defLog = defendingCards.map((c) => `-${this.formatCard(c)}`).join(', ');
    this.state.actionLog.push(`${client.sessionId} defended: ${defLog}`);

    // Track draw log for clipboard
    this.state.players.forEach((p) => {
      const amount = DurakEngine.computeDrawAmount(
        p,
        this.state.deck.length,
        this.state.targetHandSize,
      );
      if (amount > 0) {
        const drawnRaw = this.state.deck.slice(-amount).reverse();
        const drawnFormatted = drawnRaw.map((c) => `+${this.formatCard(c)}`).join(', ');
        this.state.actionLog.push(`${p.id} drew: ${drawnFormatted}`);
      }
    });

    DurakEngine.replenishAll(this.state);
    this.checkGameOver();

    // Increment chain
    this.state.defenseChainCount++;

    if (this.state.defenseChainCount >= this.state.players.size - 1) {
      // Everyone in the circle successfully defended!
      DurakEngine.endRound(this.state, null);

      // Log replenishment
      this.state.players.forEach((p) => {
        const amount = DurakEngine.computeDrawAmount(
          p,
          this.state.deck.length,
          this.state.targetHandSize,
        );
        if (amount > 0) {
          const drawnRaw = this.state.deck.slice(-amount).reverse(); // simulate draw for log
          const drawnFormatted = drawnRaw.map((c) => `+${this.formatCard(c)}`).join(', ');
          this.state.actionLog.push(`${p.id} drew: ${drawnFormatted}`);
        }
      });

      DurakEngine.replenishAll(this.state);
      this.checkGameOver();

      // The next trick is led by the player who made the LAST defense in this chain.
      // Since currentTurn is already the client who just defended, we simply leave it alone!
      this.state.turnStartTime = Date.now();
      this.startTurnTimer();
    } else {
      // The circle continues! The next player must now beat the cards just played.
      this.nextTurn();
    }
  }

  private handlePickUp(client: Client) {
    if (this.state.currentTurn !== client.sessionId) return;

    // Track cards BEFORE they are moved to hand by endRound
    const pickedUpCards: string[] = [];
    this.state.table.forEach((c) => pickedUpCards.push(`+${this.formatCard(c)}`));
    this.state.activeAttackCards.forEach((c) => pickedUpCards.push(`+${this.formatCard(c)}`));

    // Use engine to handle pickup logic
    DurakEngine.endRound(this.state, client.sessionId);

    // Also check for replenishment if picker-upper had few cards (per standard rules or variant)
    // Though usually picker-upper doesn't draw if they pick up, but we let replenishAll handle checks
    this.state.players.forEach((p) => {
      if (p.id === client.sessionId) return; // Picker upper already got cards from table
      const amount = DurakEngine.computeDrawAmount(
        p,
        this.state.deck.length,
        this.state.targetHandSize,
      );
      if (amount > 0) {
        const drawnRaw = this.state.deck.slice(-amount).reverse();
        const drawnFormatted = drawnRaw.map((c) => `+${this.formatCard(c)}`).join(', ');
        this.state.actionLog.push(`${p.id} drew: ${drawnFormatted}`);
      }
    });

    DurakEngine.replenishAll(this.state);
    this.checkGameOver();

    // Next player starts fresh
    this.state.actionLog.push(`${client.sessionId} picked up: ${pickedUpCards.join(', ')}`);
    this.nextTurn();
  }

  private handleSwapHuzur(client: Client) {
    const player = this.state.players.get(client.sessionId)!;
    const success = DurakEngine.swapHuzur(player, this.state);
    if (!success) {
      client.send(
        'error',
        'Cannot swap Huzur. You need the 7 of trump, and the deck cannot be empty.',
      );
    }
  }

  private checkGameOver() {
    if (this.state.phase !== 'playing') return;

    // A player wins if the deck is empty and they have no cards left
    // We check every player
    let hasNewWinner = false;
    this.state.players.forEach((player, id) => {
      // check if player already in winners list
      const alreadyWon = this.state.winners.includes(id);

      if (this.state.deck.length === 0 && player.hand.length === 0 && !alreadyWon) {
        this.state.winners.push(id);
        hasNewWinner = true;
        this.broadcast('playerWon', id);
      }
    });

    if (hasNewWinner) {
      // Are there any players left who haven't won?
      const remainingPlayers = Array.from(this.state.players.keys()).filter(
        (id) => !this.state.winners.includes(id),
      );

      if (remainingPlayers.length <= 1) {
        this.state.phase = 'finished';
        // Clean up the turn timer
        if (this.turnTimeoutId) {
          clearInterval(this.turnTimeoutId);
          this.turnTimeoutId = null;
        }
        if (remainingPlayers.length === 1) {
          this.state.loser = remainingPlayers[0];
          this.broadcast('gameOver', { loser: this.state.loser });
          this.saveGameLog();
        } else {
          // It's a draw (multi-person win on last beat)
          this.broadcast('gameOver', { loser: null, draw: true });
          this.saveGameLog();
        }
      }
    }
  }

  private async saveGameLog() {
    try {
      // Only attempt to save if mongoose has an active connection (i.e. MONGO_URI is set)
      if (mongoose.connection.readyState === 1 || mongoose.connection.readyState === 2) {
        const log = new GameLog({
          roomId: this.roomId,
          mode: this.state.mode,
          players: Array.from(this.state.players.keys()),
          winners: Array.from(this.state.winners),
          durak: this.state.loser,
          huzurSetting: this.state.huzurSuit,
          actionLog: Array.from(this.state.actionLog),
        });
        await log.save();
        console.log(`Saved GameLog to MongoDB for room ${this.roomId}`);
      }
    } catch (e) {
      console.error('Failed to save GameLog to MongoDB:', e);
    }
  }
}
