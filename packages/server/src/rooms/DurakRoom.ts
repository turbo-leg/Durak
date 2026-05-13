import { Room, Client } from 'colyseus';
import { GameState, DurakEngine, Card, Player } from '@durak/shared';

import { GameLog } from '../models/GameLog';
import { PlayerProfile } from '../models/PlayerProfile';
import mongoose from 'mongoose';
import { openAIBot, BotDifficulty } from '../ai/OpenAIBot';

const RATE_LIMIT_MAX = 10; // messages per window
const RATE_LIMIT_WINDOW_MS = 1000;
const MAX_USERNAME_LEN = 32;
const MAX_AVATAR_URL_LEN = 256;
const MAX_SHORT_STRING_LEN = 32; // mode, teamSelection, etc.

export class DurakRoom extends Room<GameState> {
  maxClients = 100; // Enforced manually in onJoin; spectators bypass the Colyseus cap
  private turnTimeoutId: NodeJS.Timeout | null = null;
  private testModeDeck?: any;
  private botIds = new Map<string, BotDifficulty>(); // sessionId → difficulty
  private rateLimitMap = new Map<string, number[]>(); // sessionId → timestamps
  private spectators = new Set<string>(); // sessionIds of read-only spectators
  private discordInstanceId: string | null = null;

  onCreate(options: any) {
    this.setState(new GameState());

    // Apply custom options
    this.state.maxPlayers = options.maxPlayers ? parseInt(options.maxPlayers, 10) : 6;
    // maxClients is set to 100 at class level; player cap is enforced in onJoin/onAuth

    this.state.isPrivate = !!options.isPrivate;
    this.setPrivate(this.state.isPrivate);

    if (options.mode) {
      this.state.mode = String(options.mode).slice(0, MAX_SHORT_STRING_LEN);
    } // "classic" | "teams" etc. (defaults to "classic" in GameState)

    if (options.teamSelection) {
      this.state.teamSelection = String(options.teamSelection).slice(0, MAX_SHORT_STRING_LEN);
    }

    if (options.handSize) {
      this.state.targetHandSize = parseInt(options.handSize, 10);
    }

    this.discordInstanceId = options.discordInstanceId || null;
    this.setMetadata({
      mode: this.state.mode,
      discordInstanceId: this.discordInstanceId,
      maxPlayers: this.state.maxPlayers,
      playerCount: 0,
      spectatorCount: 0,
      phase: this.state.phase,
    });

    this.testModeDeck = options.testModeDeck;

    // Register Handlers
    this.onMessage('attack', (client, message) => {
      if (this.spectators.has(client.sessionId)) return;
      if (this.isRateLimited(client.sessionId)) return;
      this.handleAttack(client, message);
    });
    this.onMessage('defend', (client, message) => {
      if (this.spectators.has(client.sessionId)) return;
      if (this.isRateLimited(client.sessionId)) return;
      this.handleDefend(client, message);
    });
    this.onMessage('pickUp', (client) => {
      if (this.spectators.has(client.sessionId)) return;
      if (this.isRateLimited(client.sessionId)) return;
      this.handlePickUp(client);
    });
    this.onMessage('swapHuzur', (client) => {
      if (this.spectators.has(client.sessionId)) return;
      if (this.isRateLimited(client.sessionId)) return;
      this.handleSwapHuzur(client);
    });
    this.onMessage('ping', (client, message: { clientTime: number }) => {
      if (this.isRateLimited(client.sessionId)) return;
      client.send('pong', { clientTime: message.clientTime, serverTime: Date.now() });
    });

    // Developer Mode Action Handler
    this.onMessage('dev_action', (client, message) => {
      if (this.isRateLimited(client.sessionId)) return;
      // NOTE: In a real app, verify process.env.NODE_ENV !== "production"
      // Host-only: only the lobby leader can mutate game state via dev actions.
      if (client.sessionId !== this.state.hostId) return;

      if (message.action === 'spawn_dummies') {
        const count = message.count || this.state.maxPlayers - this.state.players.size;
        const isDummy = message.difficulty === 'dummy';
        const difficulty: BotDifficulty = message.difficulty === 'hard' ? 'hard' : 'easy';

        let spawned = 0;
        for (let i = 0; i < count; i++) {
          if (this.state.players.size >= this.state.maxPlayers) break;
          const prefix = isDummy ? 'dummy' : 'bot';
          const id = `${prefix}-${Math.random().toString(36).substring(2, 7)}`;
          const p = new Player(id);
          p.username = isDummy ? `Dummy` : `Bot (${difficulty})`;
          p.isReady = true;

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
          // Dummies have no AI — they are controlled manually via play_as dev actions
          if (!isDummy) this.botIds.set(id, difficulty);
          spawned++;
        }
        const label = isDummy ? 'dummy/dummies' : `${difficulty} bot(s)`;
        this.broadcast(
          'info',
          `Spawned ${spawned} ${label}. Room is at ${this.state.players.size}/${this.state.maxPlayers}`,
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
      if (this.isRateLimited(client.sessionId)) return;
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
      if (this.isRateLimited(client.sessionId)) return;
      if (this.state.phase !== 'waiting' || client.sessionId !== this.state.hostId) return;
      if (message.mode) this.state.mode = String(message.mode).slice(0, MAX_SHORT_STRING_LEN);
      if (message.teamSelection)
        this.state.teamSelection = String(message.teamSelection).slice(0, MAX_SHORT_STRING_LEN);
      if (message.maxPlayers) {
        this.state.maxPlayers = parseInt(message.maxPlayers, 10);
      }
      if (message.targetHandSize) {
        const requestedHandSize = parseInt(message.targetHandSize, 10);
        this.state.targetHandSize = requestedHandSize === 7 ? 7 : 5;
      }
    });

    // Start Game Manually
    this.onMessage('startGame', (client) => {
      if (this.isRateLimited(client.sessionId)) return;
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
      if (this.isRateLimited(client.sessionId)) return;
      if (this.state.phase !== 'waiting') return;
      const player = this.state.players.get(client.sessionId);
      if (player) {
        player.isReady = message.isReady;
      }
    });
  }

  private updateLobbyMetadata() {
    this.setMetadata({
      mode: this.state.mode,
      discordInstanceId: this.discordInstanceId,
      maxPlayers: this.state.maxPlayers,
      playerCount: this.state.players.size,
      spectatorCount: this.spectators.size,
      phase: this.state.phase,
    });
  }

  async onAuth(_client: Client, options: any) {
    if (this.state.phase === 'playing') {
      if (!options?.spectator) throw new Error('Game already in progress');
      return true;
    }
    if (options?.spectator) throw new Error('Game has not started yet');
    if (this.state.players.size >= this.state.maxPlayers) throw new Error('Room is full');
    return true;
  }

  onJoin(client: Client, options: any) {
    console.log(client.sessionId, 'joined!');

    if (options?.spectator) {
      this.spectators.add(client.sessionId);
      this.state.spectatorCount = this.spectators.size;
      this.updateLobbyMetadata();
      return;
    }

    const player = new Player(client.sessionId);
    if (options.username)
      player.username = String(options.username).trim().slice(0, MAX_USERNAME_LEN);
    if (options.avatarUrl)
      player.avatarUrl = String(options.avatarUrl).trim().slice(0, MAX_AVATAR_URL_LEN);
    if (options.discordId)
      player.discordId = String(options.discordId).trim().slice(0, MAX_SHORT_STRING_LEN);
    if (options.userId) player.userId = String(options.userId).trim().slice(0, 64);

    // First player is host
    if (this.state.players.size === 0) {
      this.state.hostId = client.sessionId;
      player.isReady = true; // Host is ready by default
    }

    this.state.players.set(client.sessionId, player);
    this.updateLobbyMetadata();
  }

  async onLeave(client: Client, consented: boolean) {
    console.log(client.sessionId, 'left!', consented ? '(consented)' : '(unexpected)');
    this.rateLimitMap.delete(client.sessionId);

    if (this.spectators.has(client.sessionId)) {
      this.spectators.delete(client.sessionId);
      this.state.spectatorCount = this.spectators.size;
      this.updateLobbyMetadata();
      return;
    }

    const isInGame = this.state.phase === 'playing';

    if (isInGame && !consented) {
      const player = this.state.players.get(client.sessionId);
      const displayName = player?.username || client.sessionId.slice(0, 6);
      this.broadcast('info', `${displayName} disconnected. Waiting up to 30s for reconnection...`);

      // Schedule auto-pickup after 5s if it's their turn, so the game doesn't freeze
      let pickupTimer: NodeJS.Timeout | null = null;
      if (this.state.currentTurn === client.sessionId) {
        pickupTimer = setTimeout(() => {
          if (this.state.currentTurn === client.sessionId) {
            this.broadcast('clearDefenseSnapshot');
            DurakEngine.endRound(this.state, client.sessionId);
            DurakEngine.replenishAll(this.state);
            this.checkGameOver();
            this.nextTurn();
          }
        }, 5000);
      }

      try {
        await this.allowReconnection(client, 30);
        if (pickupTimer) clearTimeout(pickupTimer);
        this.broadcast('info', `${displayName} reconnected.`);
        return;
      } catch {
        if (pickupTimer) clearTimeout(pickupTimer);
        // Reconnection window expired - fall through to permanent removal
      }
    }

    this.permanentlyRemovePlayer(client.sessionId, isInGame);
  }

  private permanentlyRemovePlayer(sessionId: string, isInGame: boolean) {
    const wasCurrentTurn = this.state.currentTurn === sessionId;

    const seatIdx = this.state.seatOrder.indexOf(sessionId);
    if (seatIdx !== -1) this.state.seatOrder.splice(seatIdx, 1);

    this.state.players.delete(sessionId);

    if (this.state.hostId === sessionId && this.state.players.size > 0) {
      this.state.hostId = this.state.players.keys().next().value || '';
      const newHost = this.state.players.get(this.state.hostId);
      if (newHost) newHost.isReady = true;
    }

    if (isInGame) {
      if (this.state.players.size <= 1) {
        this.state.phase = 'finished';
        if (this.turnTimeoutId) {
          clearInterval(this.turnTimeoutId);
          this.turnTimeoutId = null;
        }
        this.updateLobbyMetadata();
        return;
      }
      if (wasCurrentTurn) this.nextTurn();
    }
    this.updateLobbyMetadata();
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
    this.clearRoundStateForNewGame();

    this.state.phase = 'playing';
    this.updateLobbyMetadata();
    this.state.seatOrder.splice(0, this.state.seatOrder.length);
    this.state.lastDefenseAt = 0;

    // Initialize the deck right before game starts
    const deck = DurakEngine.createDeck();
    let shuffled = this.testModeDeck ? this.testModeDeck : DurakEngine.shuffleDeck(deck);
    shuffled.forEach((card: Card) => this.state.deck.push(card));

    // Choose the Huzur (Trump) card — peek at deck[0] (the bottom).
    // Do NOT pop+unshift: ArraySchema v2 unshift corrupts internal state and
    // causes deck size to balloon on replay. deck[0] is already the bottom
    // (pop() deals from the end, so index 0 is dealt last).
    const huzurRaw = this.state.deck[0];
    if (huzurRaw) {
      const clonedHuzur = new Card(huzurRaw.suit, huzurRaw.rank, huzurRaw.isJoker);
      this.state.huzurCard = clonedHuzur;
      this.state.huzurSuit = DurakEngine.getTrumpSuit(clonedHuzur);
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

    // Suhuh: each player (or one rep per team) draws 1 card to determine first attacker.
    // Highest card wins; falls back to lowest-trump-in-hand if the deck is empty.
    const { firstId, draws } = this.resolveSuhuh();
    this.state.currentTurn = firstId;
    if (draws.length > 0) {
      this.broadcast('suhuhResult', { draws, winnerId: firstId });
    }
    this.state.turnStartTime = Date.now();

    // Start turn timeout enforcement
    this.startTurnTimer();
    this.scheduleBotTurn(firstId);
  }

  /** Returns true if card `a` outranks card `b` for the suhuh draw. */
  private cardBeats(a: Card, b: Card): boolean {
    if (a.isJoker && !b.isJoker) return true;
    if (!a.isJoker && b.isJoker) return false;
    if (a.isJoker && b.isJoker) return a.rank > b.rank;
    if (a.suit === this.state.huzurSuit && b.suit !== this.state.huzurSuit) return true;
    if (a.suit !== this.state.huzurSuit && b.suit === this.state.huzurSuit) return false;
    return a.rank > b.rank;
  }

  /**
   * Suhuh first-turn resolution (issue #123).
   * Each player draws 1 card; highest card wins. In teams mode only one player
   * per team draws, and the winning team's first player in seat order starts.
   * Falls back to lowest-trump-in-hand when the deck is empty after the deal.
   */
  private resolveSuhuh(): {
    firstId: string;
    draws: Array<{ playerId: string; suit: string; rank: number; isJoker: boolean }>;
  } {
    const seatOrder = Array.from(this.state.seatOrder).filter((id): id is string => id != null);
    const fallbackId = seatOrder[0]!;

    if (this.state.deck.length === 0) {
      // Deck exhausted during deal (e.g. 6p 7-card) — fall back to lowest trump in hand
      let firstId = fallbackId;
      let lowestTrumpRank = Infinity;
      this.state.players.forEach((player, id) => {
        player.hand.forEach((card) => {
          if (card.suit === this.state.huzurSuit && card.rank < lowestTrumpRank) {
            lowestTrumpRank = card.rank;
            firstId = id;
          }
        });
      });
      this.state.actionLog.push(`suhuh first: ${firstId}`);
      return { firstId, draws: [] };
    }

    const draws: Array<{ playerId: string; suit: string; rank: number; isJoker: boolean }> = [];

    if (this.state.mode === 'teams') {
      // One representative per team draws; winning team's first player in seat order starts
      const teamReps = new Map<number, string>(); // team -> first player in seat order
      for (const id of seatOrder) {
        const team = this.state.players.get(id)!.team;
        if (!teamReps.has(team)) teamReps.set(team, id);
      }

      let winningTeam = -1;
      let winningCard: Card | null = null;

      teamReps.forEach((repId, team) => {
        if (this.state.deck.length === 0) return;
        const drawn = this.state.deck.pop()!;
        const card = new Card(drawn.suit, drawn.rank, drawn.isJoker);
        this.state.players.get(repId)!.hand.push(card);
        this.state.actionLog.push(`suhuh ${repId}: +${this.formatCard(card)}`);
        draws.push({ playerId: repId, suit: card.suit, rank: card.rank, isJoker: card.isJoker });
        if (!winningCard || this.cardBeats(card, winningCard)) {
          winningCard = card;
          winningTeam = team;
        }
      });

      const firstId =
        seatOrder.find((id) => this.state.players.get(id)!.team === winningTeam) ?? fallbackId;
      this.state.actionLog.push(`suhuh first: ${firstId}`);
      return { firstId, draws };
    } else {
      // FFA: every player draws one card
      let firstId = fallbackId;
      let highCard: Card | null = null;

      for (const id of seatOrder) {
        if (this.state.deck.length === 0) break;
        const drawn = this.state.deck.pop()!;
        const card = new Card(drawn.suit, drawn.rank, drawn.isJoker);
        this.state.players.get(id)!.hand.push(card);
        this.state.actionLog.push(`suhuh ${id}: +${this.formatCard(card)}`);
        draws.push({ playerId: id, suit: card.suit, rank: card.rank, isJoker: card.isJoker });
        if (!highCard || this.cardBeats(card, highCard)) {
          highCard = card;
          firstId = id;
        }
      }

      this.state.actionLog.push(`suhuh first: ${firstId}`);
      return { firstId, draws };
    }
  }

  private clearRoundStateForNewGame() {
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

  private resetGameStateForReplay() {
    this.state.phase = 'waiting';
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
          this.broadcast('clearDefenseSnapshot');
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
    const ids = Array.from(this.state.seatOrder);
    const idx = ids.indexOf(this.state.currentTurn);
    if (idx === -1) return;

    // Skip players who have already won — they have no cards and can't act
    for (let skip = 1; skip < ids.length; skip++) {
      const candidateId = ids[(idx + skip) % ids.length];
      if (!candidateId || this.state.winners.includes(candidateId)) continue;
      this.state.currentTurn = candidateId;
      this.state.turnStartTime = Date.now();
      this.startTurnTimer();
      this.scheduleBotTurn(candidateId);
      return;
    }
  }

  private scheduleBotTurn(playerId: string) {
    const difficulty = this.botIds.get(playerId);
    if (!difficulty) return;

    const delay = 800 + Math.random() * 1200; // 0.8–2s human-like pause
    setTimeout(async () => {
      // Abort if turn changed while we were waiting
      if (this.state.currentTurn !== playerId || this.state.phase !== 'playing') return;

      const activeLen = this.state.activeAttackCards.length;
      const handLen = this.state.players.get(playerId)?.hand.length ?? 0;
      console.log(
        `[Bot ${playerId.slice(0, 8)}] firing: role=${activeLen > 0 ? 'DEFEND' : 'ATTACK'} activeAttacks=${activeLen} hand=${handLen}`,
      );

      const move = await openAIBot.think(this.state, playerId, difficulty);
      console.log(
        `[Bot ${playerId.slice(0, 8)}] chose: ${move ? `${move.action} cards=${JSON.stringify(move.cards)}` : 'null'}`,
      );
      if (!move) return;
      if (this.state.currentTurn !== playerId || this.state.phase !== 'playing') return;

      const fakeClient = {
        sessionId: playerId,
        send: (type: string, msg: string) =>
          console.log(`[Bot ${playerId.slice(0, 8)}] server error: ${type} ${msg}`),
      } as unknown as Client;
      if (move.action === 'attack') this.handleAttack(fakeClient, { cards: move.cards });
      else if (move.action === 'defend') this.handleDefend(fakeClient, { cards: move.cards });
      else if (move.action === 'pickup') this.handlePickUp(fakeClient);
    }, delay);
  }

  private isRateLimited(sessionId: string): boolean {
    const now = Date.now();
    const cutoff = now - RATE_LIMIT_WINDOW_MS;
    const timestamps = this.rateLimitMap.get(sessionId) ?? [];
    // Prune entries outside the sliding window
    const recent = timestamps.filter((t) => t > cutoff);
    if (recent.length >= RATE_LIMIT_MAX) {
      this.rateLimitMap.set(sessionId, recent);
      return true;
    }
    recent.push(now);
    this.rateLimitMap.set(sessionId, recent);
    return false;
  }

  private logPendingDraws(skipId?: string): void {
    this.state.players.forEach((p) => {
      if (skipId && p.id === skipId) return;
      const amount = DurakEngine.computeDrawAmount(
        p,
        this.state.deck.length,
        this.state.targetHandSize,
      );
      if (amount > 0) {
        const drawnRaw = this.state.deck.slice(-amount).reverse();
        this.state.actionLog.push(
          `${p.id} drew: ${drawnRaw.map((c) => `+${this.formatCard(c)}`).join(', ')}`,
        );
      }
    });
  }

  private parseCards(raw: any): Card[] | null {
    if (!Array.isArray(raw) || raw.length === 0) return null;
    const cards: Card[] = [];
    for (const c of raw) {
      if (
        typeof c?.suit !== 'string' ||
        typeof c?.rank !== 'number' ||
        typeof c?.isJoker !== 'boolean'
      )
        return null;
      cards.push(new Card(c.suit, c.rank, c.isJoker));
    }
    return cards;
  }

  /** Returns true iff every card in `cards` is present in the player's hand (deduplication-aware). */
  private playerOwnsCards(player: Player, cards: Card[]): boolean {
    const remaining = Array.from(player.hand)
      .filter((c): c is Card => !!c)
      .map((c) => ({ suit: c.suit, rank: c.rank }));
    for (const c of cards) {
      const idx = remaining.findIndex((h) => h.suit === c.suit && h.rank === c.rank);
      if (idx === -1) return false;
      remaining.splice(idx, 1);
    }
    return true;
  }

  private handleAttack(client: Client, message: { cards: any[] }) {
    if (this.state.phase !== 'playing') return;
    if (this.state.currentTurn !== client.sessionId) return;

    const player = this.state.players.get(client.sessionId);
    if (!player) return;

    const cardsToPlay = this.parseCards(message.cards);
    if (!cardsToPlay) {
      client.send('error', 'Invalid card format.');
      return;
    }

    if (!this.playerOwnsCards(player, cardsToPlay)) {
      client.send('error', 'You do not have those cards.');
      return;
    }

    // Validate attack legality
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
      const tableCards = Array.from(this.state.table).filter((c): c is Card => !!c);
      const activeAttacks = Array.from(this.state.activeAttackCards).filter((c): c is Card => !!c);
      if (!DurakEngine.isValidAttackAddition(cardsToPlay[0]!, tableCards, activeAttacks)) {
        client.send('error', 'You can only attack with a rank that is already on the table.');
        return;
      }
    }

    this.broadcast('clearDefenseSnapshot');

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
    this.logPendingDraws();
    DurakEngine.replenishAll(this.state);

    // Pass turn to next defender
    this.nextTurn();
  }

  private handleDefend(client: Client, message: { cards: any[] }) {
    if (this.state.phase !== 'playing') return;
    if (this.state.currentTurn !== client.sessionId) return;

    const player = this.state.players.get(client.sessionId);
    if (!player) return;

    const atkCards = Array.from(this.state.activeAttackCards).filter((c): c is Card => !!c);
    if (atkCards.length === 0) {
      client.send('error', 'No active attack to defend.');
      return;
    }

    const defendingCards = this.parseCards(message.cards);
    if (!defendingCards) {
      client.send('error', 'Invalid card format.');
      return;
    }

    if (defendingCards.length !== atkCards.length) {
      client.send('error', 'Must defend each attacking card exactly once.');
      return;
    }

    if (!this.playerOwnsCards(player, defendingCards)) {
      client.send('error', 'You do not have those cards.');
      return;
    }

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

    this.logPendingDraws();
    DurakEngine.replenishAll(this.state);
    this.checkGameOver();

    // Increment chain
    this.state.defenseChainCount++;

    const activePlayers = Array.from(this.state.seatOrder).filter(
      (id): id is string => !!id && !this.state.winners.includes(id),
    ).length;
    if (this.state.defenseChainCount >= activePlayers - 1) {
      // Broadcast the cards before clearing so clients can animate the discard
      const discardedCards = [
        ...Array.from(this.state.tableStacks).filter((c): c is Card => !!c),
        ...Array.from(this.state.activeAttackCards).filter((c): c is Card => !!c),
      ].map((c) => ({ suit: c.suit, rank: c.rank, isJoker: c.isJoker }));
      this.broadcast('roundDiscarded', { cards: discardedCards });

      // Everyone in the circle successfully defended!
      DurakEngine.endRound(this.state, null);

      this.logPendingDraws();
      DurakEngine.replenishAll(this.state);
      this.checkGameOver();

      // The next trick is led by the player who made the LAST defense in this chain.
      // Since currentTurn is already the client who just defended, we simply leave it alone!
      this.state.turnStartTime = Date.now();
      this.startTurnTimer();
      this.scheduleBotTurn(this.state.currentTurn);
    } else {
      // The circle continues! The next player must now beat the cards just played.
      this.nextTurn();
    }
  }

  private handlePickUp(client: Client) {
    if (this.state.phase !== 'playing') return;
    if (this.state.currentTurn !== client.sessionId) return;

    if (this.state.activeAttackCards.length === 0) {
      client.send('error', 'Nothing to pick up.');
      return;
    }

    this.broadcast('clearDefenseSnapshot');

    // Track cards BEFORE they are moved to hand by endRound
    const pickedUpCards: string[] = [];
    this.state.table.forEach((c) => pickedUpCards.push(`+${this.formatCard(c)}`));
    this.state.activeAttackCards.forEach((c) => pickedUpCards.push(`+${this.formatCard(c)}`));

    // Use engine to handle pickup logic
    DurakEngine.endRound(this.state, client.sessionId);

    this.logPendingDraws(client.sessionId); // picker-upper already got cards from table
    DurakEngine.replenishAll(this.state);
    this.checkGameOver();

    // Next player starts fresh
    this.state.actionLog.push(`${client.sessionId} picked up: ${pickedUpCards.join(', ')}`);
    this.nextTurn();
  }

  private handleSwapHuzur(client: Client) {
    if (this.state.phase !== 'playing') return;
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
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
      if (mongoose.connection.readyState !== 1 && mongoose.connection.readyState !== 2) return;

      const sessionIds = Array.from(this.state.players.keys());
      const players = sessionIds.map((id) => this.state.players.get(id)!);
      const discordIds = players.map((p) => p?.discordId ?? '');
      const userIds = players.map((p) => p?.userId ?? '');
      const winnerSessions = Array.from(this.state.winners);

      const log = new GameLog({
        roomId: this.roomId,
        mode: this.state.mode,
        players: sessionIds,
        discordIds,
        userIds,
        winners: winnerSessions,
        durak: this.state.loser,
        huzurSetting: this.state.huzurSuit,
        actionLog: Array.from(this.state.actionLog),
      });
      await log.save();
      console.log(`Saved GameLog to MongoDB for room ${this.roomId}`);

      // Upsert PlayerProfile for every authenticated participant (Discord or email)
      const profileOps = players
        .filter((p) => p?.discordId || p?.userId)
        .map((p) => {
          const isWinner = winnerSessions.includes(p.id);
          const isDurak = this.state.loser === p.id;
          const filter = p.discordId ? { discordId: p.discordId } : { userId: p.userId };
          const setFields = p.discordId
            ? { discordId: p.discordId, username: p.username, avatarUrl: p.avatarUrl }
            : { userId: p.userId, username: p.username, avatarUrl: p.avatarUrl };
          return PlayerProfile.findOneAndUpdate(
            filter,
            {
              $set: setFields,
              $inc: {
                'stats.gamesPlayed': 1,
                'stats.wins': isWinner ? 1 : 0,
                'stats.losses': isDurak ? 1 : 0,
                'stats.durakCount': isDurak ? 1 : 0,
              },
            },
            { upsert: true, new: true },
          );
        });
      await Promise.all(profileOps);
    } catch (e) {
      console.error('Failed to save GameLog to MongoDB:', e);
    }
  }
}
