import { Room, Client } from 'colyseus';
import {
  GameState,
  DurakEngine,
  Card,
  Player,
  isAvatarPreset,
  LOOK_INTERVAL_MS,
  LOOK_YAW_LIMIT,
  LOOK_PITCH_MIN,
  LOOK_PITCH_MAX,
  isGesture,
  GESTURE_COOLDOWN_MS,
  GESTURE_DURATION_MS,
  COUNTDOWN_MS,
  OPENING_MS,
  TAKEOVER_GRACE_MS,
  OpeningDraw,
  SeatRequest,
} from '@durak/shared';
import pino from 'pino';
import * as Sentry from '@sentry/node';

import { GameLog } from '../models/GameLog';
import { PlayerProfile } from '../models/PlayerProfile';
import { calculateEloDeltas, EloPlayer } from '../utils/EloEngine';
import { evaluateBadges, BADGES } from '../utils/Badges';
import mongoose from 'mongoose';
import { botEngine, BotDifficulty } from '../ai/BotEngine';
import { verifyRoomIdentity, type RoomIdentity } from '../auth/session';
import { isRecord, roomSettings } from './roomSettings';
import { nextBot } from './botNames';
import { observeOpponentResponse, type OpponentResponseMemory } from '../ai/BotOpponentResponses';

const logger = pino(
  process.env.NODE_ENV !== 'production'
    ? { transport: { target: 'pino-pretty' } }
    : { level: process.env.LOG_LEVEL ?? 'info' },
);

const RATE_LIMIT_MAX = 10; // messages per window
const RATE_LIMIT_WINDOW_MS = 1000;
const MAX_USERNAME_LEN = 32;
const MAX_AVATAR_URL_LEN = 256;

export class DurakRoom extends Room<GameState> {
  maxClients = 100; // Enforced manually in onJoin; spectators bypass the Colyseus cap
  private turnTimeoutId: NodeJS.Timeout | null = null;
  private testModeDeck?: any;
  private gameRandom: () => number = Math.random;
  private readonly opponentResponseMemory: OpponentResponseMemory = new Map();
  private botIds = new Map<string, BotDifficulty>(); // sessionId → difficulty
  private soloDifficulty: BotDifficulty | null = null;
  private rateLimitMap = new Map<string, number[]>(); // sessionId → timestamps
  private spectators = new Set<string>(); // sessionIds of read-only spectators
  private discordInstanceId: string | null = null;
  private rematchVotes = new Set<string>(); // sessionIds that voted for rematch
  private horseNextGameTimer?: { clear(): void };
  private lookTimes = new Map<string, number>();
  private gestureTimes = new Map<string, number>();
  private watcherIdentities = new Map<string, RoomIdentity>();
  private pendingSeatOptions = new Map<string, Record<string, unknown>>();
  // Temporary bot control: takeover grace timers, held reconnections, and
  // serials that invalidate delayed bot work when a game, turn or seat owner changes.
  private takeoverTimers = new Map<string, { clear(): void }>();
  private reservations = new Map<string, ReturnType<Room['allowReconnection']>>();
  private controlSerial = new Map<string, number>();
  private gameSerial = 0;
  private turnSerial = 0;
  // Private-table lifecycle (countdown → opening). Room-clock timer only.
  private lifecycleTimer?: { clear(): void };
  private countdownReturn: 'waiting' | 'finished' = 'waiting';
  private countdownMs = COUNTDOWN_MS;
  private openingMs = OPENING_MS;
  private takeoverMs = TAKEOVER_GRACE_MS;
  // Horse on a private table: the next deal continues (or restarts) the match.
  private horseContinues = false;

  setGameRandom(random: () => number): void {
    this.gameRandom = random;
  }

  getOpponentResponseMemory(): OpponentResponseMemory {
    return this.opponentResponseMemory;
  }

  onCreate(options: any) {
    this.setState(new GameState());
    Object.assign(this.state, roomSettings(options));
    if (options.isPrivate !== undefined && typeof options.isPrivate !== 'boolean') {
      throw new Error('isPrivate must be a boolean');
    }
    // maxClients is set to 100 at class level; player cap is enforced in onJoin/onAuth

    this.state.isPrivate = !!options.isPrivate;
    this.setPrivate(this.state.isPrivate);

    if (options.botDifficulty !== undefined) {
      if (
        !this.state.isPrivate ||
        this.state.mode !== 'classic' ||
        this.state.maxPlayers !== 2 ||
        ![5, 7].includes(this.state.targetHandSize) ||
        !['easy', 'hard'].includes(options.botDifficulty)
      )
        throw new Error(
          'Solo requires a private two-player Classic room, 5 or 7 cards, and easy or hard difficulty',
        );
      this.soloDifficulty = options.botDifficulty;
    }

    if (
      options.discordInstanceId !== undefined &&
      options.discordInstanceId !== null &&
      (typeof options.discordInstanceId !== 'string' || options.discordInstanceId.length > 128)
    ) {
      throw new Error('Invalid Discord instance');
    }
    this.discordInstanceId = options.discordInstanceId || null;
    this.setMetadata({
      mode: this.state.mode,
      discordInstanceId: this.discordInstanceId,
      maxPlayers: this.state.maxPlayers,
      playerCount: 0,
      spectatorCount: 0,
      phase: this.state.phase,
    }).catch(() => {});

    // Deterministic decks are test fixtures, never client-controlled production input.
    this.testModeDeck = process.env.NODE_ENV === 'test' ? options.testModeDeck : undefined;
    if (process.env.NODE_ENV === 'test' && isRecord(options.lifecycleTiming)) {
      const { countdownMs, openingMs, takeoverMs } = options.lifecycleTiming;
      if (Number.isFinite(countdownMs)) this.countdownMs = countdownMs as number;
      if (Number.isFinite(openingMs)) this.openingMs = openingMs as number;
      if (Number.isFinite(takeoverMs)) this.takeoverMs = takeoverMs as number;
    }

    // Register Handlers
    this.onMessage('look', (client, message) => this.handleLook(client, message));
    this.onMessage('gesture', (client, message: unknown) => {
      const player = this.state.players.get(client.sessionId);
      if (
        this.spectators.has(client.sessionId) ||
        !player ||
        player.control !== 'human' ||
        !['waiting', 'playing', 'finished'].includes(this.state.phase) ||
        !isRecord(message) ||
        !isGesture(message.id)
      )
        return;
      const now = Date.now();
      if (now - (this.gestureTimes.get(client.sessionId) ?? -Infinity) < GESTURE_COOLDOWN_MS)
        return;
      this.gestureTimes.set(client.sessionId, now);
      player.gestureId = message.id;
      player.gestureStartedAt = now;
      player.gestureSequence++;
      const sequence = player.gestureSequence;
      this.clock.setTimeout(() => {
        if (
          this.state.players.get(client.sessionId) === player &&
          player.gestureSequence === sequence
        )
          player.gestureId = '';
      }, GESTURE_DURATION_MS);
    });
    this.onMessage('avatarPreset', (client, message) => {
      if (this.spectators.has(client.sessionId) || this.isRateLimited(client.sessionId)) return;
      const player = this.state.players.get(client.sessionId);
      if (
        player &&
        this.state.phase === 'waiting' &&
        isRecord(message) &&
        isAvatarPreset(message.preset)
      )
        player.avatarPreset = message.preset;
    });
    // Watchers (invited or late) ask to join; seats fill in arrival order between games.
    this.onMessage('requestSeat', (client, message) => {
      if (this.isRateLimited(client.sessionId)) return;
      this.handleSeatRequest(client, message);
    });
    this.onMessage('cancelSeatRequest', (client) => {
      if (this.isRateLimited(client.sessionId)) return;
      this.dropSeatRequest(client.sessionId);
      this.pendingSeatOptions.delete(client.sessionId);
    });
    // Private-table seats: the host fills empty seats with bots between games.
    this.onMessage('addBot', (client, message) => {
      if (this.isRateLimited(client.sessionId) || !this.canEditTable(client)) return;
      const difficulty = isRecord(message) ? message.difficulty : undefined;
      if (difficulty !== 'easy' && difficulty !== 'hard') return;
      if (this.state.players.size >= this.state.maxPlayers) {
        client.send('error', 'Every seat is already taken.');
        return;
      }
      const id = `bot-${Math.random().toString(36).substring(2, 9)}`;
      const bot = new Player(id);
      this.nameBot(bot);
      bot.isReady = true;
      bot.control = 'bot';
      bot.team = this.balancedTeam();
      this.state.players.set(id, bot);
      this.botIds.set(id, difficulty);
      if (this.state.phase === 'finished') this.state.seatOrder.push(id);
      this.rosterChanged();
    });
    this.onMessage('removeBot', (client, message) => {
      if (this.isRateLimited(client.sessionId) || !this.canEditTable(client)) return;
      const id = isRecord(message) ? message.playerId : undefined;
      // Only permanent bots are unowned; temporary stand-ins belong to a player.
      if (typeof id !== 'string' || this.state.players.get(id)?.control !== 'bot') return;
      this.botIds.delete(id);
      this.state.players.delete(id);
      const seat = this.state.seatOrder.indexOf(id);
      if (seat !== -1) this.state.seatOrder.splice(seat, 1);
      this.rosterChanged();
      this.processSeatQueue();
    });
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
      if (!isRecord(message) || !Number.isFinite(message.clientTime)) return;
      client.send('pong', { clientTime: message.clientTime, serverTime: Date.now() });
    });

    // Defense staging — transient face-down ghosts visible to other players
    // while the defender is mid-drag (no card identity leaks).
    this.onMessage('defendStage', (client, message: { attackerKey?: string }) => {
      if (this.spectators.has(client.sessionId)) return;
      if (this.isRateLimited(client.sessionId)) return;
      this.handleDefendStage(client, message, 'add');
    });
    this.onMessage('defendUnstage', (client, message: { attackerKey?: string }) => {
      if (this.spectators.has(client.sessionId)) return;
      if (this.isRateLimited(client.sessionId)) return;
      this.handleDefendStage(client, message, 'remove');
    });

    // Broadcast that the defender has picked up (started dragging) a card from their hand.
    // Other players see a face-down ghost on ALL pending attacker slots immediately.
    this.onMessage('defenderDragging', (client) => {
      if (this.isRateLimited(client.sessionId)) return;
      if (this.spectators.has(client.sessionId)) return;
      if (this.state.currentTurn !== client.sessionId) return;
      if (this.state.activeAttackCards.length === 0) return;
      this.broadcast('defenderDragging', { defenderId: client.sessionId }, { except: client });
    });
    this.onMessage('defenderDragEnd', (client) => {
      if (this.isRateLimited(client.sessionId)) return;
      if (this.spectators.has(client.sessionId)) return;
      this.broadcast('defenderDragEnd', { defenderId: client.sessionId }, { except: client });
    });

    // Developer Mode Action Handler
    this.onMessage('dev_action', (client, message) => {
      if (this.isRateLimited(client.sessionId)) return;
      if (!message || typeof message !== 'object') return;
      // Lobby controls use this channel to add real bots. All other production
      // mutations (including manually controlled dummies) are debug-only.
      if (
        process.env.NODE_ENV === 'production' &&
        (message.action !== 'spawn_dummies' ||
          message.difficulty === 'dummy' ||
          !['easy', 'hard'].includes(message.difficulty))
      )
        return;
      // Host-only: only the lobby leader can mutate game state via dev actions.
      if (client.sessionId !== this.state.hostId) return;

      if (message.action === 'spawn_dummies') {
        if (this.state.phase !== 'waiting') return;
        const count = message.count || this.state.maxPlayers - this.state.players.size;
        const isDummy = message.difficulty === 'dummy';
        const difficulty: BotDifficulty = message.difficulty === 'hard' ? 'hard' : 'easy';

        let spawned = 0;
        for (let i = 0; i < count; i++) {
          if (this.state.players.size >= this.state.maxPlayers) break;
          const prefix = isDummy ? 'dummy' : 'bot';
          const id = `${prefix}-${Math.random().toString(36).substring(2, 7)}`;
          const p = new Player(id);
          if (isDummy) {
            p.username = 'Dummy';
            p.avatarPreset = 'casual';
          } else this.nameBot(p);
          p.isReady = true;
          p.control = 'bot';
          p.team = this.balancedTeam();

          this.state.players.set(id, p);
          // Dummies have no AI — they are controlled manually via play_as dev actions
          if (!isDummy) this.botIds.set(id, difficulty);
          spawned++;
        }
        if (spawned) this.rosterChanged();
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
      if (!isRecord(message) || (message.team !== 0 && message.team !== 1)) return;
      if (
        this.isBetweenGames() &&
        (this.state.mode === 'teams' || this.state.mode === 'horse') &&
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

          if (player.team === targetTeam) return;
          player.team = targetTeam;
          client.send('info', `You joined ${targetTeam === 0 ? 'Team Blue' : 'Team Red'}.`);
          this.rosterChanged();
        }
      }
    });

    // Update Lobby Settings
    this.onMessage('updateSettings', (client, message) => {
      if (this.isRateLimited(client.sessionId)) return;
      if (!this.canEditTable(client)) return; // host only; matchmade rooms are locked
      try {
        const settings = roomSettings(message, this.state);
        if (settings.maxPlayers < this.state.players.size)
          throw new Error('Cannot remove occupied seats');
        if (this.soloDifficulty && (settings.maxPlayers !== 2 || settings.mode !== 'classic')) {
          throw new Error('Solo settings cannot change player count or mode');
        }
        const before = `${this.state.mode}:${this.state.maxPlayers}`;
        Object.assign(this.state, settings);
        // A different format starts a fresh Horse match.
        if (before !== `${this.state.mode}:${this.state.maxPlayers}`) this.resetHorseMatch();
        this.cancelCountdown();
        this.resetHumanReadiness();
        this.processSeatQueue(); // more seats may admit people waiting in line
        this.updateLobbyMetadata();
      } catch (error) {
        client.send('error', error instanceof Error ? error.message : 'Invalid room settings');
      }
    });

    // Start Game Manually (private lobbies only)
    this.onMessage('startGame', (client) => {
      if (this.isRateLimited(client.sessionId)) return;
      if (client.sessionId !== this.state.hostId) return;
      if (this.state.phase !== 'waiting') return;
      if (this.state.isPrivate) {
        // Private tables start themselves once every seat is filled and ready.
        client.send('info', 'The table starts automatically when every seat is filled and ready.');
        return;
      }

      const playerCount = Array.from(this.state.players.values()).length;
      if (this.state.mode !== 'classic' && ![4, 6].includes(playerCount)) {
        client.send('error', 'Teams and Horse require 4 or 6 players to start.');
        return;
      }
      if (playerCount < 2) {
        client.send('error', 'Need at least 2 players to start.');
        return;
      }
      const allReady = Array.from(this.state.players.values()).every((p) => p.isReady);
      if (!allReady) {
        client.send('error', 'All players must be ready to start.');
        return;
      }

      if (
        (this.state.mode === 'teams' || this.state.mode === 'horse') &&
        this.state.teamSelection === 'manual'
      ) {
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

    // Rematch voting — any player in a finished game can request a rematch
    this.onMessage('rematchVote', (client, message: { accept: boolean }) => {
      if (this.isRateLimited(client.sessionId)) return;
      if (!isRecord(message) || typeof message.accept !== 'boolean') return;
      if (this.state.phase !== 'finished') return;
      if (!this.state.players.has(client.sessionId)) return;
      if (this.state.isPrivate) {
        // Private tables use "Ready for next game" instead of rematch voting.
        client.send('info', 'Press Ready for the next game.');
        return;
      }

      // A Horse sub-game continues on the room clock; votes only restart a completed match.
      if (
        this.state.mode === 'horse' &&
        this.state.horseTeamA.length < 5 &&
        this.state.horseTeamB.length < 5
      )
        return;

      const player = this.state.players.get(client.sessionId)!;

      if (!message.accept) {
        // One decline cancels the rematch for everyone
        this.rematchVotes.clear();
        this.broadcast('rematchDeclined', {
          username: player.username || client.sessionId.slice(0, 6),
        });
        return;
      }

      this.rematchVotes.add(client.sessionId);
      const humanPlayers = Array.from(this.state.players.keys()).filter(
        (id) => !this.botIds.has(id),
      );
      this.broadcast('rematchVoted', {
        sessionId: client.sessionId,
        username: player.username || client.sessionId.slice(0, 6),
        votes: this.rematchVotes.size,
        needed: humanPlayers.length,
      });

      if (this.rematchVotes.size >= humanPlayers.length) {
        this.rematchVotes.clear();
        if (this.state.mode === 'horse') {
          this.state.horseTeamA = '';
          this.state.horseTeamB = '';
          this.state.horseGame = 1;
        }
        this.resetGameStateForReplay();
        this.startGame();
      }
    });

    // Allow players to ready up manually
    this.onMessage('toggleReady', (client, message) => {
      if (this.isRateLimited(client.sessionId)) return;
      if (!isRecord(message) || typeof message.isReady !== 'boolean') return;
      const between = this.state.isPrivate ? this.isBetweenGames() : this.state.phase === 'waiting';
      if (!between) return;
      const player = this.state.players.get(client.sessionId);
      if (!player || player.control !== 'human' || !player.connected) return;
      player.isReady = message.isReady;
      if (this.state.isPrivate) this.evaluateCountdown();
    });
  }

  // ── Private-table lifecycle ────────────────────────────────────────────────

  /** Waiting for the first deal, showing results, or counting down to a deal. */
  private isBetweenGames() {
    return ['waiting', 'finished', 'countdown'].includes(this.state.phase);
  }

  /** The host may edit seats and settings of a private table between games. */
  private canEditTable(client: Client) {
    return this.state.isPrivate && client.sessionId === this.state.hostId && this.isBetweenGames();
  }

  /** Name a new bot the first of the bot names nobody at the table has, with its look. */
  private nameBot(bot: Player) {
    const { name, avatarPreset } = nextBot(
      Array.from(this.state.players.values(), (player) => player.username),
    );
    bot.username = name;
    bot.avatarPreset = avatarPreset;
  }

  private balancedTeam() {
    if (this.state.mode !== 'teams' && this.state.mode !== 'horse') return 0;
    const players = Array.from(this.state.players.values());
    const blue = players.filter((p) => p.team === 0).length;
    return blue <= players.length - blue ? 0 : 1;
  }

  /** Why the table cannot deal yet, or null when every start condition holds. */
  private startBlocker(): string | null {
    const players = Array.from(this.state.players.values());
    const humans = players.filter((p) => p.control === 'human');
    if (players.length < this.state.maxPlayers) return 'Waiting for every seat to fill.';
    if (humans.length === 0) return 'A table needs at least one person.';
    if (this.state.mode !== 'classic') {
      if (![4, 6].includes(players.length)) return 'Teams and Horse need 4 or 6 seats.';
      if (this.state.teamSelection === 'manual') {
        const blue = players.filter((p) => p.team === 0).length;
        if (blue * 2 !== players.length) return 'Teams must be balanced.';
      }
    }
    if (humans.some((p) => !p.connected || !p.isReady)) return 'Waiting for everyone to be ready.';
    return null;
  }

  /** Start or cancel the countdown to match the current table. */
  private evaluateCountdown() {
    if (!this.state.isPrivate) return;
    const ready = this.startBlocker() === null;
    if (this.state.phase === 'countdown' && !ready) this.cancelCountdown();
    else if (ready && (this.state.phase === 'waiting' || this.state.phase === 'finished'))
      this.beginCountdown();
  }

  private beginCountdown() {
    this.countdownReturn = this.state.phase === 'finished' ? 'finished' : 'waiting';
    this.state.phase = 'countdown';
    this.state.phaseEndsAt = Date.now() + this.countdownMs;
    this.lifecycleTimer?.clear();
    this.lifecycleTimer = this.clock.setTimeout(() => {
      this.lifecycleTimer = undefined;
      if (this.state.phase !== 'countdown') return;
      if (this.startBlocker() !== null) {
        this.cancelCountdown();
        return;
      }
      this.startGame({ opening: true });
    }, this.countdownMs);
    this.updateLobbyMetadata();
  }

  private cancelCountdown() {
    if (this.state.phase !== 'countdown') return;
    this.lifecycleTimer?.clear();
    this.lifecycleTimer = undefined;
    this.state.phase = this.countdownReturn;
    this.state.phaseEndsAt = 0;
    this.updateLobbyMetadata();
  }

  /** Creates a human seat from validated join options and a verified identity. */
  private seatPlayer(sessionId: string, options: Record<string, unknown>, identity?: RoomIdentity) {
    const player = new Player(sessionId);
    if (isAvatarPreset(options.avatarPreset)) player.avatarPreset = options.avatarPreset;
    if (options.username)
      player.username = String(options.username).trim().slice(0, MAX_USERNAME_LEN);
    if (options.avatarUrl)
      player.avatarUrl = String(options.avatarUrl).trim().slice(0, MAX_AVATAR_URL_LEN);
    player.discordId = identity?.discordId ?? '';
    player.userId = identity?.userId ?? '';
    player.team = this.balancedTeam();

    // First player is host
    if (!this.state.hostId || !this.state.players.has(this.state.hostId)) {
      this.state.hostId = sessionId;
      // Public hosts are ready by default; private tables ready up explicitly.
      if (!this.state.isPrivate) player.isReady = true;
    }

    this.state.players.set(sessionId, player);
    // A seat taken between games joins the table now; seat order is rebuilt at the deal.
    if (this.state.phase === 'finished') this.state.seatOrder.push(sessionId);
    return player;
  }

  private dropSeatRequest(sessionId: string) {
    const index = this.state.seatRequests.findIndex((r) => r.id === sessionId);
    if (index !== -1) this.state.seatRequests.splice(index, 1);
  }

  /** A watcher asks for a seat: seated now if one is free between games, otherwise queued. */
  private handleSeatRequest(client: Client, message: unknown) {
    if (!this.state.isPrivate || !this.spectators.has(client.sessionId)) return;
    const options = isRecord(message) ? message : {};
    const identity = this.watcherIdentities.get(client.sessionId);
    if (
      Array.from(this.state.players.values()).some(
        (p) =>
          (identity?.userId && p.userId === identity.userId) ||
          (identity?.discordId && p.discordId === identity.discordId),
      )
    ) {
      client.send('error', 'This account is already seated');
      return;
    }
    const existing = this.state.seatRequests.find((r) => r.id === client.sessionId);
    const name =
      String(options.username ?? '')
        .trim()
        .slice(0, MAX_USERNAME_LEN) || 'Guest';
    if (existing) existing.name = name;
    else this.state.seatRequests.push(new SeatRequest(client.sessionId, name));
    this.pendingSeatOptions.set(client.sessionId, {
      username: name,
      avatarPreset: options.avatarPreset,
    });
    this.processSeatQueue();
    if (this.spectators.has(client.sessionId))
      client.send('info', 'You’re in line for the next free seat.');
  }

  /** Seats waiting watchers in arrival order. Only empty seats are filled, between games. */
  private processSeatQueue() {
    if (!this.state.isPrivate) return;
    let seated = false;
    while (
      (this.state.phase === 'waiting' || this.state.phase === 'finished') &&
      this.state.players.size < this.state.maxPlayers &&
      this.state.seatRequests.length > 0
    ) {
      const request = this.state.seatRequests.shift()!;
      const sessionId = request.id;
      if (!this.spectators.has(sessionId)) continue;
      const identity = this.watcherIdentities.get(sessionId);
      const client = this.clients.find((c) => c.sessionId === sessionId);
      if (
        Array.from(this.state.players.values()).some(
          (p) =>
            (identity?.userId && p.userId === identity.userId) ||
            (identity?.discordId && p.discordId === identity.discordId),
        )
      ) {
        client?.send('error', 'This account is already seated');
        continue;
      }
      this.spectators.delete(sessionId);
      this.state.spectatorCount = this.spectators.size;
      this.watcherIdentities.delete(sessionId);
      this.seatPlayer(sessionId, this.pendingSeatOptions.get(sessionId) ?? {}, identity);
      this.pendingSeatOptions.delete(sessionId);
      client?.send('seated', {});
      seated = true;
    }
    if (seated) this.rosterChanged();
  }

  private resetHumanReadiness() {
    this.state.players.forEach((p) => {
      if (p.control === 'human') p.isReady = false;
    });
  }

  /** Joins, departures, bot and team changes invalidate a countdown in progress. */
  private rosterChanged() {
    if (!this.state.isPrivate) return;
    if (this.state.phase === 'countdown') {
      this.cancelCountdown();
      this.resetHumanReadiness();
    } else {
      // e.g. a bot filling the last seat while everyone is already ready.
      this.evaluateCountdown();
    }
    this.updateLobbyMetadata();
  }

  private resetHorseMatch() {
    this.state.horseTeamA = '';
    this.state.horseTeamB = '';
    this.state.horseGame = 1;
    this.horseContinues = false;
  }

  /** The opening has shown the deal, Huzur and Suhuh; the first turn begins now. */
  private beginPlay() {
    if (this.state.phase !== 'opening') return;
    this.state.phase = 'playing';
    this.state.phaseEndsAt = 0;
    this.state.turnStartTime = Date.now();
    this.updateLobbyMetadata();
    this.startTurnTimer();
    this.scheduleBotTurn(this.state.currentTurn);
  }

  /** Results stay on the table; everyone readies again for the next deal. */
  private finishPrivateGame() {
    if (!this.state.isPrivate) return;
    this.state.phaseEndsAt = 0;
    this.resetHumanReadiness();
    this.releaseDepartedSeats();
    // People waiting to join take any empty seats for the next game.
    this.processSeatQueue();
  }

  private updateLobbyMetadata() {
    try {
      this.setMetadata({
        mode: this.state.mode,
        discordInstanceId: this.discordInstanceId,
        maxPlayers: this.state.maxPlayers,
        playerCount: this.state.players.size,
        spectatorCount: this.spectators.size,
        phase: this.state.phase,
      }).catch(() => {});
    } catch {
      // setMetadata requires an active room listing; no-op in test environments
    }
  }

  onBeforePatch() {
    this.syncPublicCounts();
  }

  private syncPublicCounts() {
    this.state.deckCount = this.state.deck.length;
    this.state.players.forEach((player) => {
      player.handCount = player.hand.length;
    });
  }

  async onAuth(_client: Client, options: any) {
    if (!isRecord(options)) throw new Error('Invalid join options');
    if (options.spectator !== undefined && typeof options.spectator !== 'boolean')
      throw new Error('Invalid spectator option');
    const identity = verifyRoomIdentity(options ?? {});
    const live = this.state.phase === 'playing' || this.state.phase === 'opening';
    if (live) {
      if (!options?.spectator) throw new Error('Game already in progress');
      return identity;
    }
    if (options?.spectator) {
      // Friends may watch a private table at any point; public tables only during play.
      if (this.state.isPrivate) return identity;
      throw new Error('Game has not started yet');
    }
    if (this.state.players.size >= this.state.maxPlayers) throw new Error('Room is full');
    // Seats go to people already waiting in line, in order.
    if (this.state.isPrivate && this.state.seatRequests.length > 0)
      throw new Error('Others are waiting for a seat. Join to watch and get in line.');
    const requested = roomSettings(options, this.state);
    if (requested.targetHandSize !== this.state.targetHandSize)
      throw new Error('Hand size mismatch');

    // Hard-reject mismatched matchmaking options so a Colyseus routing quirk
    // can never put a Classic player into a Teams room (or vice versa).
    if (!options?.spectator && this.state.phase === 'waiting') {
      if (options?.mode && String(options.mode) !== this.state.mode) {
        throw new Error('Game mode mismatch');
      }
      if (requested.maxPlayers !== this.state.maxPlayers) {
        throw new Error('Player count mismatch');
      }
    }

    const seatable =
      this.state.phase === 'waiting' || (this.state.isPrivate && this.state.phase === 'finished');
    if (!seatable) throw new Error('Game has finished');
    if (
      Array.from(this.state.players.values()).some(
        (p) =>
          (identity.userId && p.userId === identity.userId) ||
          (identity.discordId && p.discordId === identity.discordId),
      )
    )
      throw new Error('This account is already seated');
    return identity;
  }

  onJoin(client: Client, options: any, identity?: RoomIdentity) {
    logger.info({ sessionId: client.sessionId }, 'client joined');

    if (options?.spectator) {
      this.syncPublicCounts();
      this.spectators.add(client.sessionId);
      // Kept so an invited watcher can later take a seat under the same verified identity.
      this.watcherIdentities.set(client.sessionId, identity ?? { userId: '', discordId: '' });
      this.state.spectatorCount = this.spectators.size;
      this.updateLobbyMetadata();
      return;
    }

    const player = this.seatPlayer(client.sessionId, options, identity);

    if (this.soloDifficulty && this.state.players.size === 1) {
      const botId = `bot-${client.sessionId}`;
      const bot = new Player(botId);
      this.nameBot(bot);
      bot.isReady = true;
      bot.control = 'bot';
      this.state.players.set(botId, bot);
      this.botIds.set(botId, this.soloDifficulty);
      // Practice deals at once; the client finishes connecting before the opening.
      this.clock.setTimeout(() => {
        if (this.state.phase === 'waiting' && this.state.players.has(client.sessionId)) {
          this.startGame({ opening: true });
        }
      }, 50);
    }
    this.rosterChanged();
    this.updateLobbyMetadata();

    // Auto-start for matchmade (non-private) rooms: mark player ready and
    // start immediately once the lobby is full.
    if (!this.state.isPrivate && this.state.phase === 'waiting') {
      player.isReady = true;
      const playerCount = Array.from(this.state.players.values()).length;
      if (playerCount >= this.state.maxPlayers) {
        // Defer one tick so all onJoin state changes are committed before game logic runs.
        this.clock.setTimeout(() => {
          if (this.state.phase === 'waiting') {
            this.startGame();
          }
        }, 50);
      }
    }
  }

  async onLeave(client: Client, consented: boolean) {
    logger.info({ sessionId: client.sessionId, consented }, 'client left');
    this.rateLimitMap.delete(client.sessionId);
    this.lookTimes.delete(client.sessionId);
    this.gestureTimes.delete(client.sessionId);
    const leaving = this.state.players.get(client.sessionId);
    if (leaving) {
      leaving.headYaw = 0;
      leaving.headPitch = 0;
    }
    this.clearDefenseGhostsFor(client.sessionId);

    if (this.spectators.has(client.sessionId)) {
      this.spectators.delete(client.sessionId);
      this.watcherIdentities.delete(client.sessionId);
      this.pendingSeatOptions.delete(client.sessionId);
      this.dropSeatRequest(client.sessionId);
      this.state.spectatorCount = this.spectators.size;
      this.updateLobbyMetadata();
      return;
    }

    const isInGame = this.state.phase === 'playing' || this.state.phase === 'opening';

    if (isInGame && this.state.isPrivate && leaving) {
      await this.holdSeatForGame(client, leaving, consented);
      return;
    }

    if (isInGame && !consented) {
      const player = this.state.players.get(client.sessionId);
      const displayName = player?.username || client.sessionId.slice(0, 6);
      this.broadcast('info', `${displayName} disconnected. Waiting up to 30s for reconnection...`);
      this.broadcast('playerDisconnected', { sessionId: client.sessionId, username: displayName });

      // Schedule auto-pickup after 5s if it's their turn, so the game doesn't freeze
      let pickupTimer: NodeJS.Timeout | null = null;
      if (this.state.currentTurn === client.sessionId && this.state.phase === 'playing') {
        pickupTimer = setTimeout(() => {
          if (this.state.currentTurn === client.sessionId && this.state.phase === 'playing') {
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
        this.broadcast('playerReconnected', { sessionId: client.sessionId });
        return;
      } catch {
        if (pickupTimer) clearTimeout(pickupTimer);
        // Reconnection window expired
        if (!this.state.isPrivate) {
          // Ranked game: abort instead of continuing with a player down
          this.broadcast('gameAborted', {
            reason: `${displayName} disconnected and did not reconnect.`,
          });
          this.state.phase = 'finished';
          if (this.turnTimeoutId) {
            clearInterval(this.turnTimeoutId);
            this.turnTimeoutId = null;
          }
          this.updateLobbyMetadata();
          return;
        }
        // Private game: fall through to permanent removal and continue
      }
    }

    this.permanentlyRemovePlayer(client.sessionId, isInGame);
  }

  // ── Temporary bot control on private tables ────────────────────────────────

  /**
   * A private-table seat is reserved until the game ends. A lost connection is
   * marked at once and an Easy stand-in plays the same seat after a short grace;
   * leaving on purpose hands the seat over immediately.
   */
  private async holdSeatForGame(client: Client, player: Player, consented: boolean) {
    const id = client.sessionId;
    const name = player.username || id.slice(0, 6);
    player.connected = false;
    player.isReady = false;
    this.broadcast('playerDisconnected', { sessionId: id, username: name });
    if (consented) {
      this.broadcast('info', `${name} left. A bot plays their seat for the rest of this game.`);
      this.transferHostFrom(id);
      this.makeStandIn(id);
      return;
    }
    this.broadcast('info', `${name} lost connection. A bot takes over in a few seconds.`);
    this.takeoverTimers.get(id)?.clear();
    this.takeoverTimers.set(
      id,
      this.clock.setTimeout(() => {
        this.takeoverTimers.delete(id);
        this.makeStandIn(id);
      }, this.takeoverMs),
    );
    const reservation = this.allowReconnection(client, 'manual');
    this.reservations.set(id, reservation);
    try {
      await reservation;
      if (this.reservations.get(id) === reservation) this.reservations.delete(id);
      this.restoreHuman(id);
    } catch {
      // Released when the game ended (or the room closed); see releaseDepartedSeats.
      if (this.reservations.get(id) === reservation) this.reservations.delete(id);
    }
  }

  private makeStandIn(id: string) {
    const player = this.state.players.get(id);
    if (!player || player.connected || player.control !== 'human') return;
    if (this.state.phase !== 'playing' && this.state.phase !== 'opening') return;
    player.control = 'standin';
    this.botIds.set(id, 'easy');
    this.bumpControl(id);
    this.broadcast('seatControl', { sessionId: id, control: 'standin' });
    // During the opening, beginPlay schedules whoever leads.
    if (this.state.phase === 'playing' && this.state.currentTurn === id) this.scheduleBotTurn(id);
  }

  /** The person is back: pending bot work is invalidated and the seat is theirs again. */
  private restoreHuman(id: string) {
    this.takeoverTimers.get(id)?.clear();
    this.takeoverTimers.delete(id);
    const player = this.state.players.get(id);
    if (!player) return;
    player.connected = true;
    if (player.control === 'standin') {
      player.control = 'human';
      this.botIds.delete(id);
    }
    this.bumpControl(id);
    this.broadcast('playerReconnected', { sessionId: id });
    this.broadcast('seatControl', { sessionId: id, control: 'human' });
  }

  private bumpControl(id: string) {
    this.controlSerial.set(id, (this.controlSerial.get(id) ?? 0) + 1);
  }

  /** At game end, seats of people who left or never came back are released. */
  private releaseDepartedSeats() {
    const departed = Array.from(this.state.players.values()).filter(
      (p) => !p.connected && p.control !== 'bot',
    );
    for (const player of departed) {
      this.takeoverTimers.get(player.id)?.clear();
      this.takeoverTimers.delete(player.id);
      const reservation = this.reservations.get(player.id);
      this.reservations.delete(player.id);
      reservation?.reject(new Error('Seat released at game end'));
      this.permanentlyRemovePlayer(player.id, false);
    }
  }

  /** Host controls pass to the next connected human in seat order, never to a bot. */
  private transferHostFrom(sessionId: string) {
    if (this.state.hostId !== sessionId) return;
    const order = Array.from(this.state.seatOrder).filter((id): id is string => !!id);
    const seatIdx = order.indexOf(sessionId);
    const humans = Array.from(this.state.players.values()).filter(
      (p) => p.id !== sessionId && p.control === 'human' && p.connected,
    );
    const after = seatIdx === -1 ? [] : [...order.slice(seatIdx + 1), ...order.slice(0, seatIdx)];
    const next = after.map((id) => humans.find((p) => p.id === id)).find((p) => !!p) ?? humans[0];
    this.state.hostId = next?.id ?? '';
    if (next && !this.state.isPrivate) next.isReady = true;
  }

  private permanentlyRemovePlayer(sessionId: string, isInGame: boolean) {
    const wasCurrentTurn = this.state.currentTurn === sessionId;

    const seatIdx = this.state.seatOrder.indexOf(sessionId);
    // Choose the successor before the seat disappears from the order.
    const order = Array.from(this.state.seatOrder).filter((id): id is string => !!id);
    let successor = '';
    for (let step = 1; seatIdx !== -1 && step < order.length; step++) {
      const id = order[(seatIdx + step) % order.length]!;
      if (!this.state.winners.includes(id)) {
        successor = id;
        break;
      }
    }
    this.transferHostFrom(sessionId);
    if (seatIdx !== -1) this.state.seatOrder.splice(seatIdx, 1);

    this.state.players.delete(sessionId);
    this.botIds.delete(sessionId);
    this.opponentResponseMemory.delete(sessionId);
    this.controlSerial.delete(sessionId);

    if (isInGame) {
      if (this.state.players.size <= 1) {
        this.state.phase = 'finished';
        this.state.phaseEndsAt = 0;
        this.lifecycleTimer?.clear();
        this.lifecycleTimer = undefined;
        if (this.turnTimeoutId) {
          clearInterval(this.turnTimeoutId);
          this.turnTimeoutId = null;
        }
        this.finishPrivateGame();
        this.updateLobbyMetadata();
        return;
      }
      if (wasCurrentTurn && successor) {
        if (this.state.phase === 'opening') {
          // The turn clock starts when the opening ends.
          this.state.currentTurn = successor;
        } else {
          this.state.currentTurn = successor;
          this.state.turnStartTime = Date.now();
          this.startTurnTimer();
          this.scheduleBotTurn(successor);
        }
      }
    } else {
      this.rosterChanged();
      this.processSeatQueue();
    }
    this.updateLobbyMetadata();
  }

  private formatCard(c: Card): string {
    if (c.isJoker) return c.rank === 17 ? 'BJ' : 'RJ';
    const suits: any = { Clubs: 'c', Diamonds: 'd', Hearts: 'h', Spades: 's' };
    let r = c.rank.toString();
    if (c.rank === 11) r = 'J';
    else if (c.rank === 12) r = 'Q';
    else if (c.rank === 13) r = 'K';
    else if (c.rank === 14) r = '3';
    else if (c.rank === 15) r = '2';
    else if (c.rank === 16) r = 'A';
    return `${r}${suits[c.suit] || c.suit.charAt(0).toLowerCase()}`;
  }

  /**
   * Deals a new game. With `opening`, the table shows the deal, Huzur and Suhuh
   * for a fixed time before the first turn (and its clock) begins.
   */
  private startGame({ opening = false }: { opening?: boolean } = {}) {
    this.horseNextGameTimer?.clear();
    this.horseNextGameTimer = undefined;
    this.lifecycleTimer?.clear();
    this.lifecycleTimer = undefined;
    const playerCount = Array.from(this.state.players.values()).length;
    if (playerCount < 2) return; // Guard: never start with fewer than 2 players
    this.gameSerial++;

    if (this.state.isPrivate && this.state.mode === 'horse') {
      // Letters carry between sub-games; a finished match starts over.
      if (this.state.horseTeamA.length >= 5 || this.state.horseTeamB.length >= 5)
        this.resetHorseMatch();
      else if (this.horseContinues) this.state.horseGame += 1;
      this.horseContinues = false;
    }

    this.rematchVotes.clear();
    this.clearRoundStateForNewGame();

    this.state.phase = opening ? 'opening' : 'playing';
    this.state.phaseEndsAt = 0;
    this.updateLobbyMetadata();
    this.state.seatOrder.splice(0, this.state.seatOrder.length);
    this.state.lastDefenseAt = 0;

    // Initialize the deck right before game starts
    const deck = DurakEngine.createDeck();
    const shuffled = this.testModeDeck
      ? this.testModeDeck
      : DurakEngine.shuffleDeck(deck, this.gameRandom);
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

    if (this.state.mode === 'teams' || this.state.mode === 'horse') {
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
    // Synchronized so a reconnecting client sees the same opening.
    for (const draw of draws)
      this.state.openingDraws.push(
        new OpeningDraw(draw.playerId, new Card(draw.suit, draw.rank, draw.isJoker)),
      );
    if (draws.length > 0) {
      this.broadcast('suhuhResult', { draws, winnerId: firstId });
    }

    if (opening) {
      // The first player's turn time is not consumed by the opening.
      this.state.turnStartTime = 0;
      this.state.phaseEndsAt = Date.now() + this.openingMs;
      this.lifecycleTimer = this.clock.setTimeout(() => {
        this.lifecycleTimer = undefined;
        this.beginPlay();
      }, this.openingMs);
      return;
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

    const huzur = this.state.huzurSuit.toLowerCase();
    const aSuit = a.suit.toLowerCase();
    const bSuit = b.suit.toLowerCase();

    // 1. Trump vs Non-Trump
    if (aSuit === huzur && bSuit !== huzur) return true;
    if (aSuit !== huzur && bSuit === huzur) return false;

    // 2. Rank Comparison (if different ranks)
    if (a.rank !== b.rank) {
      return a.rank > b.rank;
    }

    // 3. Suit Hierarchy Tie-breaker (if equal ranks)
    // Strength: Trump > Spades > Hearts > Clubs > Diamonds
    const getSuitStrength = (suit: string): number => {
      if (suit === huzur) return 4;
      if (suit === 'spades') return 3;
      if (suit === 'hearts') return 2;
      if (suit === 'clubs') return 1;
      if (suit === 'diamonds') return 0;
      return -1;
    };

    return getSuitStrength(aSuit) > getSuitStrength(bSuit);
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
    // Suhuh uses a separate draw: the cards are revealed for comparison only and
    // returned to the deck (shuffled back in) — they do NOT join player hands.
    const drawnForReturn: Card[] = [];

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
        drawnForReturn.push(card);
        this.state.actionLog.push(`suhuh ${repId}: ${this.formatCard(card)}`);
        draws.push({ playerId: repId, suit: card.suit, rank: card.rank, isJoker: card.isJoker });
        if (!winningCard || this.cardBeats(card, winningCard)) {
          winningCard = card;
          winningTeam = team;
        }
      });

      this.returnSuhuhCardsToDeck(drawnForReturn);

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
        drawnForReturn.push(card);
        this.state.actionLog.push(`suhuh ${id}: ${this.formatCard(card)}`);
        draws.push({ playerId: id, suit: card.suit, rank: card.rank, isJoker: card.isJoker });
        if (!highCard || this.cardBeats(card, highCard)) {
          highCard = card;
          firstId = id;
        }
      }

      this.returnSuhuhCardsToDeck(drawnForReturn);

      this.state.actionLog.push(`suhuh first: ${firstId}`);
      return { firstId, draws };
    }
  }

  /**
   * Re-inserts suhuh draw cards at random positions in the deck so they can be
   * drawn naturally later, without leaking any deterministic ordering signal.
   * Index 0 is the bottom huzur card and must stay pinned (see startGame).
   * Uses drain-and-refill via splice+push to avoid ArraySchema v2 mid-insert quirks.
   */
  private returnSuhuhCardsToDeck(cards: Card[]): void {
    if (cards.length === 0) return;

    // If deck still has cards, deck[0] is the pinned huzur; keep it at index 0.
    const hasHuzur = this.state.deck.length > 0;
    const huzur = hasHuzur ? this.state.deck[0]! : null;
    const rest: Card[] = [];
    for (let i = hasHuzur ? 1 : 0; i < this.state.deck.length; i++) rest.push(this.state.deck[i]!);

    for (const card of cards) {
      const idx = Math.floor(this.gameRandom() * (rest.length + 1));
      rest.splice(idx, 0, new Card(card.suit, card.rank, card.isJoker));
    }

    this.state.deck.splice(0, this.state.deck.length);
    if (huzur) this.state.deck.push(new Card(huzur.suit, huzur.rank, huzur.isJoker));
    rest.forEach((c) => this.state.deck.push(new Card(c.suit, c.rank, c.isJoker)));
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
    this.state.openingDraws.splice(0, this.state.openingDraws.length);

    this.state.huzurCard = new Card();
    this.state.huzurSuit = '';
    this.state.currentTurn = '';
    this.state.defenseChainCount = 0;
    this.state.turnStartTime = 0;
    this.state.lastDefenseAt = 0;
    this.state.loser = '';
    this.state.outcome = '';
    this.state.winnerName = '';
    this.state.winnerTeam = -1;

    this.state.players.forEach((player) => {
      player.hand.splice(0, player.hand.length);
      player.gestureId = '';
      player.gestureStartedAt = 0;
      player.pickedUpCardKeys.splice(0, player.pickedUpCardKeys.length);
      player.hasPickedUp = false;
      player.lastDrawLog.splice(0, player.lastDrawLog.length);
    });

    if (this.defenseGhostStaging.size > 0) {
      this.defenseGhostStaging.clear();
      this.broadcast('defenseGhostClear', { defenderId: null });
    }
  }

  private resetGameStateForReplay() {
    this.state.phase = 'waiting';
  }

  private startTurnTimer() {
    // Every new turn starts here; pending bot work for an earlier turn is now stale.
    this.turnSerial++;
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
        } else if (player?.hand[0]) {
          // A lead cannot be picked up. Play one owned card so an idle attacker
          // cannot freeze the room indefinitely after the timer reaches zero.
          this.handleAttack({ sessionId: currentPlayerId, send: () => {} } as unknown as Client, {
            cards: [player.hand[0]],
          });
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
    // The move that ended the game has no next turn.
    if (this.state.phase !== 'playing') return;
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
    // Delayed and asynchronous bot work applies only to the game, turn and seat
    // owner it was scheduled for; a reconnecting human invalidates it.
    const game = this.gameSerial;
    const turn = this.turnSerial;
    const control = this.controlSerial.get(playerId) ?? 0;
    const stillValid = () =>
      this.state.phase === 'playing' &&
      this.state.currentTurn === playerId &&
      this.gameSerial === game &&
      this.turnSerial === turn &&
      (this.controlSerial.get(playerId) ?? 0) === control &&
      this.botIds.has(playerId);
    this.clock.setTimeout(async () => {
      if (!stillValid()) return;

      const activeLen = this.state.activeAttackCards.length;
      const handLen = this.state.players.get(playerId)?.hand.length ?? 0;
      logger.info(
        {
          botId: playerId.slice(0, 8),
          role: activeLen > 0 ? 'DEFEND' : 'ATTACK',
          activeAttacks: activeLen,
          hand: handLen,
        },
        'bot firing',
      );

      const move = await botEngine.think(
        this.state,
        playerId,
        difficulty,
        this.opponentResponseMemory,
      );
      logger.info(
        {
          botId: playerId.slice(0, 8),
          move: move ? { action: move.action, cards: move.cards } : null,
        },
        'bot chose move',
      );
      if (!move || !stillValid()) return;

      const fakeClient = {
        sessionId: playerId,
        send: (type: string, msg: string) =>
          logger.error({ botId: playerId.slice(0, 8), type, msg }, 'bot server error'),
      } as unknown as Client;
      if (move.action === 'swapHuzur') {
        this.handleSwapHuzur(fakeClient);
        // Swap doesn't consume the turn — re-schedule immediately so the bot still acts.
        this.clock.setTimeout(() => {
          if (stillValid()) this.scheduleBotTurn(playerId);
        }, 400);
      } else if (move.action === 'attack') this.handleAttack(fakeClient, { cards: move.cards });
      else if (move.action === 'defend') this.handleDefend(fakeClient, { cards: move.cards });
      else if (move.action === 'pickup') this.handlePickUp(fakeClient);
    }, delay);
  }

  // Per-player set of attacker keys currently "covered" by a face-down ghost during
  // mass-defense staging. Transient, in-memory only. Cleared on commit, pickup,
  // round resolution, turn timeout, disconnect, and game start.
  private defenseGhostStaging = new Map<string, Set<string>>(); // sessionId → atkKeys

  private handleDefendStage(
    client: Client,
    message: { attackerKey?: string },
    action: 'add' | 'remove',
  ): void {
    if (this.state.phase !== 'playing') return;
    // Only the current defender may stage ghosts.
    if (this.state.currentTurn !== client.sessionId) return;
    if (this.state.activeAttackCards.length === 0) return;
    if (!isRecord(message) || typeof message.attackerKey !== 'string') return;
    const atkKey = message.attackerKey.slice(0, 32);
    if (!atkKey) return;
    // The attackerKey must reference an active attacker.
    const validKeys = new Set(
      Array.from(this.state.activeAttackCards)
        .filter((c): c is Card => !!c)
        .map((c) => `${c.suit}:${c.rank}`),
    );
    if (!validKeys.has(atkKey)) return;

    let set = this.defenseGhostStaging.get(client.sessionId);
    if (!set) {
      set = new Set();
      this.defenseGhostStaging.set(client.sessionId, set);
    }
    if (action === 'add') set.add(atkKey);
    else set.delete(atkKey);

    // Broadcast to OTHER players so they see a face-down placeholder.
    this.broadcast(
      'defenseGhost',
      { defenderId: client.sessionId, attackerKey: atkKey, action },
      { except: client },
    );
  }

  private clearDefenseGhostsFor(sessionId: string): void {
    if (!this.defenseGhostStaging.has(sessionId)) return;
    this.defenseGhostStaging.delete(sessionId);
    this.broadcast('defenseGhostClear', { defenderId: sessionId });
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

  private handleLook(client: Client, message: unknown) {
    const player = this.state.players.get(client.sessionId);
    if (!player || this.spectators.has(client.sessionId) || !isRecord(message)) return;
    const { yaw, pitch } = message;
    if (
      typeof yaw !== 'number' ||
      typeof pitch !== 'number' ||
      !Number.isFinite(yaw) ||
      !Number.isFinite(pitch)
    )
      return;
    const now = Date.now();
    if (now - (this.lookTimes.get(client.sessionId) ?? -Infinity) < LOOK_INTERVAL_MS) return;
    this.lookTimes.set(client.sessionId, now);
    player.headYaw = Math.max(-LOOK_YAW_LIMIT, Math.min(LOOK_YAW_LIMIT, yaw));
    player.headPitch = Math.max(LOOK_PITCH_MIN, Math.min(LOOK_PITCH_MAX, pitch));
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
    if (!Array.isArray(raw) || raw.length === 0 || raw.length > 7) return null;
    const cards: Card[] = [];
    for (const c of raw) {
      if (
        typeof c?.suit !== 'string' ||
        !Number.isInteger(c?.rank) ||
        c.rank < 7 ||
        c.rank > 18 ||
        typeof c?.isJoker !== 'boolean'
      )
        return null;
      cards.push(new Card(c.suit, c.rank, c.isJoker));
    }
    return cards;
  }

  /** Returns true iff every card in `cards` is present in the player's hand (deduplication-aware). */
  private playerOwnsCards(player: Player, cards: Card[]): boolean {
    const counts = new Map<string, number>();
    for (const c of player.hand) {
      if (!c) continue;
      const key = `${c.suit}:${c.rank}:${c.isJoker ? 1 : 0}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    for (const c of cards) {
      const key = `${c.suit}:${c.rank}:${c.isJoker ? 1 : 0}`;
      const count = counts.get(key) || 0;
      if (count <= 0) return false;
      counts.set(key, count - 1);
    }
    return true;
  }

  private handleAttack(client: Client, message: { cards: any[] }) {
    if (this.state.phase !== 'playing') return;
    if (this.state.currentTurn !== client.sessionId) return;

    const player = this.state.players.get(client.sessionId);
    if (!player) return;

    const cardsToPlay = this.parseCards(message?.cards);
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
    player.playSequence++;
    player.gestureId = '';

    // Move cards from hand to active attack
    const attackCounts = new Map<string, number>();
    for (const c of cardsToPlay) {
      const key = `${c.suit}:${c.rank}`;
      attackCounts.set(key, (attackCounts.get(key) || 0) + 1);
    }

    for (let i = player.hand.length - 1; i >= 0; i--) {
      const hc = player.hand[i];
      if (!hc) continue;
      const key = `${hc.suit}:${hc.rank}`;
      const count = attackCounts.get(key) || 0;
      if (count > 0) {
        attackCounts.set(key, count - 1);
        player.hand.splice(i, 1);
        this.state.activeAttackCards.push(new Card(hc.suit, hc.rank, hc.isJoker));
      }
    }

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

    const defendingCards = this.parseCards(message?.cards);
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

    observeOpponentResponse(
      this.opponentResponseMemory,
      client.sessionId,
      atkCards,
      this.state.huzurSuit,
      assignments.map((pair) => pair.def),
      this.state.table.length + atkCards.length,
    );

    // Defense accepted — clear any in-flight ghost markers for this defender.
    player.playSequence++;
    player.gestureId = '';
    this.clearDefenseGhostsFor(client.sessionId);

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
    const defendCounts = new Map<string, number>();
    for (const pair of assignments) {
      const defCard = pair.def;
      const key = `${defCard.suit}:${defCard.rank}`;
      defendCounts.set(key, (defendCounts.get(key) || 0) + 1);
    }

    for (let i = player.hand.length - 1; i >= 0; i--) {
      const hc = player.hand[i];
      if (!hc) continue;
      const key = `${hc.suit}:${hc.rank}`;
      const count = defendCounts.get(key) || 0;
      if (count > 0) {
        defendCounts.set(key, count - 1);
        player.hand.splice(i, 1);
        this.state.activeAttackCards.push(new Card(hc.suit, hc.rank, hc.isJoker));
      }
    }

    const defLog = defendingCards.map((c) => `-${this.formatCard(c)}`).join(', ');
    this.state.actionLog.push(`${client.sessionId} defended: ${defLog}`);

    this.logPendingDraws();
    DurakEngine.replenishAll(this.state);
    this.checkGameOver();
    if (this.state.phase !== 'playing') return;

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

      if (this.state.phase !== 'playing') return;
      // A last defender who just escaped has no cards with which to lead.
      // Continue clockwise to a remaining player instead of stranding their turn.
      if (this.state.winners.includes(this.state.currentTurn)) {
        this.nextTurn();
        return;
      }
      // Otherwise the last defender leads the next trick.
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
    this.clearDefenseGhostsFor(client.sessionId);

    // Track cards BEFORE they are moved to hand by endRound
    const pickedUpCards: string[] = [];
    this.state.table.forEach((c) => pickedUpCards.push(`+${this.formatCard(c)}`));
    this.state.activeAttackCards.forEach((c) => pickedUpCards.push(`+${this.formatCard(c)}`));

    observeOpponentResponse(
      this.opponentResponseMemory,
      client.sessionId,
      Array.from(this.state.activeAttackCards).filter((card): card is Card => !!card),
      this.state.huzurSuit,
      null,
      this.state.table.length + this.state.activeAttackCards.length,
    );

    // Use engine to handle pickup logic
    DurakEngine.endRound(this.state, client.sessionId);
    const player = this.state.players.get(client.sessionId);
    if (player) player.gestureId = '';

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
    if (success) player.gestureId = '';
    if (!success) {
      client.send(
        'error',
        'Cannot swap Huzur. You need the 7 of trump, and the deck cannot be empty.',
      );
    }
  }

  /**
   * The first player to run out of cards once the deck is empty wins, and the game
   * ends there. In Teams and Horse that player's whole team wins. Everyone else loses;
   * no single Durak is named.
   */
  private checkGameOver() {
    if (this.state.phase !== 'playing' || this.state.deck.length > 0) return;
    const out = Array.from(this.state.seatOrder).filter(
      (id): id is string => !!id && this.state.players.get(id)?.hand.length === 0,
    );
    if (out.length === 0) return;

    this.state.phase = 'finished';
    if (this.turnTimeoutId) {
      clearInterval(this.turnTimeoutId);
      this.turnTimeoutId = null;
    }
    const teamMode = this.state.mode === 'teams' || this.state.mode === 'horse';
    const teams = new Set(out.map((id) => this.state.players.get(id)!.team));
    // Only the player who just moved can empty a hand, so a tie is a safeguard.
    if (teamMode ? teams.size === 1 : out.length === 1) {
      const first = this.state.players.get(out[0]!)!;
      const winnerTeam = teamMode ? first.team : -1;
      const winners = teamMode
        ? Array.from(this.state.seatOrder).filter(
            (id): id is string => !!id && this.state.players.get(id)?.team === winnerTeam,
          )
        : [out[0]!];
      this.state.winners.push(...winners);
      this.state.outcome = 'win';
      this.state.winnerName = first.username || '';
      this.state.winnerTeam = winnerTeam;
      this.broadcast('gameOver', { winner: out[0], winnerTeam });
      this.saveGameLog();
      if (this.state.mode === 'horse') this.handleHorseRoundEnd(winnerTeam === 0 ? 1 : 0);
    } else {
      this.state.winners.push(...out);
      this.state.outcome = 'draw';
      this.broadcast('gameOver', { draw: true });
      this.saveGameLog();
      if (this.state.mode === 'horse') this.continueHorseMatch();
    }
    // After the result is recorded: departed seats are released for the next game.
    this.finishPrivateGame();
  }

  private handleHorseRoundEnd(losingTeam: number) {
    const LETTERS = 'HORSE';
    // 0 = team A (Blue), 1 = team B (Red)
    if (losingTeam === 0) {
      this.state.horseTeamA = LETTERS.slice(0, this.state.horseTeamA.length + 1);
    } else {
      this.state.horseTeamB = LETTERS.slice(0, this.state.horseTeamB.length + 1);
    }

    const matchOver =
      this.state.horseTeamA.length >= LETTERS.length ||
      this.state.horseTeamB.length >= LETTERS.length;

    if (matchOver) {
      const winningTeam = this.state.horseTeamA.length >= LETTERS.length ? 1 : 0;
      this.broadcast('horseMatchOver', { winningTeam });
      // Phase stays finished. The next deal (ready-up or rematch) resets the whole match.
    } else {
      this.continueHorseMatch();
    }
  }

  /** Private tables continue with the next ready-up; public tables return to the lobby. */
  private continueHorseMatch() {
    if (this.state.isPrivate) this.horseContinues = true;
    else this.scheduleHorseNextGame();
  }

  private scheduleHorseNextGame() {
    this.state.horseGame += 1;
    this.horseNextGameTimer?.clear();
    this.horseNextGameTimer = this.clock.setTimeout(() => {
      this.horseNextGameTimer = undefined;
      if (this.state.phase !== 'finished' || this.state.mode !== 'horse') return;
      this.clearRoundStateForNewGame();
      this.state.phase = 'waiting';
      this.updateLobbyMetadata();
      this.broadcast('horseNextGame', { game: this.state.horseGame });
    }, 5000);
  }

  async onDispose() {
    this.horseNextGameTimer?.clear();
    this.horseNextGameTimer = undefined;
    this.takeoverTimers.forEach((timer) => timer.clear());
    this.takeoverTimers.clear();
    this.lifecycleTimer?.clear();
    this.lifecycleTimer = undefined;
    if (this.turnTimeoutId) {
      clearInterval(this.turnTimeoutId);
      this.turnTimeoutId = null;
    }
    if (this.state.phase === 'playing') {
      try {
        await this.saveGameLog();
      } catch (e) {
        logger.error({ err: e }, 'onDispose: failed to persist game state');
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

      // Convert session IDs to the player's stable identifier (discordId > userId > sessionId)
      // so that GameLog.winners and GameLog.durak can be matched against the querying player's ID.
      const effectiveId = (sessionId: string): string => {
        const idx = sessionIds.indexOf(sessionId);
        if (idx === -1) return sessionId;
        return discordIds[idx] || userIds[idx] || sessionId;
      };

      const winnerIds = winnerSessions.filter((s): s is string => !!s).map(effectiveId);
      const durakId = this.state.loser ? effectiveId(this.state.loser) : null;

      const log = new GameLog({
        roomId: this.roomId,
        mode: this.state.mode,
        players: sessionIds,
        discordIds,
        userIds,
        winners: winnerIds,
        durak: durakId,
        huzurSetting: this.state.huzurSuit,
        actionLog: Array.from(this.state.actionLog),
      });
      await log.save();
      logger.info({ roomId: this.roomId }, 'GameLog saved to MongoDB');

      // Shutdown snapshots are useful replay evidence, never completed-match rewards.
      if (this.state.phase !== 'finished' || this.state.winners.length === 0) return;

      // Upsert PlayerProfile for every authenticated participant (Discord or email)
      const authedPlayers = players.filter((p) => p?.discordId || p?.userId);
      const eloField = this.state.mode === 'teams' ? 'eloTeams' : 'eloClassic';
      // Guests may join public tables, but a mixed/guest match cannot affect ratings.
      const isRanked = !this.state.isPrivate && authedPlayers.length === players.length;

      // Fetch current profiles so we can compute Elo deltas
      const currentProfiles = await Promise.all(
        authedPlayers.map((p) => {
          const filter = p.discordId ? { discordId: p.discordId } : { userId: p.userId };
          return PlayerProfile.findOne(filter);
        }),
      );

      const eloInputs: EloPlayer[] = authedPlayers.map((p, i) => {
        const prof = currentProfiles[i];
        const isWinner = winnerSessions.includes(p.id);
        return {
          id: p.id,
          currentElo: prof?.[eloField] ?? 1000,
          gamesPlayed: prof?.stats.gamesPlayed ?? 0,
          // Everyone who did not win lost; there are no middle places.
          placement: isWinner ? 'winner' : 'durak',
        };
      });

      // ELO deltas are only applied for ranked (non-private) games
      const eloDeltas = isRanked ? calculateEloDeltas(eloInputs) : new Map<string, number>();

      // Send eloResult BEFORE the DB write so players receive it even if they leave quickly.
      if (isRanked) {
        for (const p of authedPlayers) {
          const delta = eloDeltas.get(p.id) ?? 0;
          const prof = currentProfiles[authedPlayers.indexOf(p)];
          const oldElo = prof?.[eloField] ?? 1000;
          const newElo = Math.max(100, oldElo + delta);
          const isWinner = winnerSessions.includes(p.id);
          const isDurak = this.state.loser === p.id;
          const client = this.clients.find((c) => c.sessionId === p.id);
          if (client) {
            client.send('eloResult', { delta, oldElo, newElo, isWinner, isDurak });
          }
        }
      }

      const profileOps = authedPlayers.map((p) => {
        const isWinner = winnerSessions.includes(p.id);
        const isDurak = this.state.loser === p.id;
        const delta = eloDeltas.get(p.id) ?? 0;
        const filter = p.discordId ? { discordId: p.discordId } : { userId: p.userId };
        const setFields = p.discordId
          ? { discordId: p.discordId, username: p.username, avatarUrl: p.avatarUrl }
          : { userId: p.userId, username: p.username, avatarUrl: p.avatarUrl };
        // Aggregation pipeline update so Elo is computed atomically in the DB:
        // max(100, storedElo + delta) prevents JS read-modify-write races when
        // a player finishes two concurrent games in different rooms.
        return PlayerProfile.findOneAndUpdate(
          filter,
          [
            {
              $set: {
                ...setFields,
                // Only mutate ELO field for ranked games
                ...(isRanked && {
                  [eloField]: {
                    $max: [100, { $add: [{ $ifNull: [`$${eloField}`, 1000] }, delta] }],
                  },
                }),
                'stats.gamesPlayed': { $add: [{ $ifNull: ['$stats.gamesPlayed', 0] }, 1] },
                'stats.wins': { $add: [{ $ifNull: ['$stats.wins', 0] }, isWinner ? 1 : 0] },
                'stats.losses': { $add: [{ $ifNull: ['$stats.losses', 0] }, isWinner ? 0 : 1] },
                'stats.durakCount': {
                  $add: [{ $ifNull: ['$stats.durakCount', 0] }, isDurak ? 1 : 0],
                },
                'stats.winStreak': isWinner
                  ? { $add: [{ $ifNull: ['$stats.winStreak', 0] }, 1] }
                  : 0,
                'stats.durakFreeStreak': isDurak
                  ? 0
                  : { $add: [{ $ifNull: ['$stats.durakFreeStreak', 0] }, 1] },
              },
            },
          ],
          { upsert: true, returnDocument: 'after', updatePipeline: true },
        );
      });
      const updatedProfiles = await Promise.all(profileOps);

      // Push final stats to each player so the profile page never shows stale data
      for (const [i, p] of authedPlayers.entries()) {
        const updated = updatedProfiles[i];
        if (!updated) continue;
        const client = this.clients.find((c) => c.sessionId === p.id);
        if (client) {
          client.send('statsUpdated', {
            eloClassic: updated.eloClassic ?? 1000,
            eloTeams: updated.eloTeams ?? 1000,
            stats: updated.stats,
            coins: updated.coins ?? 0,
            badges: updated.badges ?? [],
          });
        }
      }

      // Award any newly earned badges
      const badgeResults: { playerName: string; newBadges: string[] }[] = [];
      const badgeOps = authedPlayers.map((p, i) => {
        const updatedProfile = updatedProfiles[i];
        if (!updatedProfile) return null;
        const isWinner = winnerSessions.includes(p.id);
        const newBadges = evaluateBadges(updatedProfile, isWinner);
        if (newBadges.length === 0) return null;
        badgeResults.push({ playerName: p.username, newBadges });
        return PlayerProfile.findByIdAndUpdate(updatedProfile._id, {
          $addToSet: { badges: { $each: newBadges } },
        });
      });
      await Promise.all(badgeOps.filter(Boolean));

      for (const { playerName, newBadges } of badgeResults) {
        this.notifyBadgeUnlocks(playerName, newBadges);
      }

      // Award coins: winners +10, everyone else +3
      const coinOps = authedPlayers.map((p) => {
        const isWinner = winnerSessions.includes(p.id);
        const award = isWinner ? 10 : 3;
        const filter = p.discordId ? { discordId: p.discordId } : { userId: p.userId };
        return PlayerProfile.findOneAndUpdate(filter, { $inc: { coins: award } });
      });
      await Promise.all(coinOps);
    } catch (e) {
      Sentry.captureException(e);
      logger.error({ err: e }, 'Failed to save GameLog to MongoDB');
    }
  }

  private notifyBadgeUnlocks(playerName: string, badgeIds: string[]): void {
    const defs = badgeIds
      .map((id) => BADGES.find((b) => b.id === id))
      .filter(Boolean) as (typeof BADGES)[number][];
    if (defs.length === 0) return;
    const lines = defs.map((b) => `${b.emoji} **${b.name}** — ${b.description}`).join('\n');
    this.broadcast('badgeUnlocked', {
      playerName,
      badges: defs.map((b) => b.id),
      message: `${playerName} unlocked:\n${lines}`,
    });
  }
}
