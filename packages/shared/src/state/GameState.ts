import { type, filter, Schema, MapSchema, ArraySchema } from '@colyseus/schema';
import { Player } from './Player';
import { Card } from './Card';
import { OpeningDraw } from './OpeningDraw';
import { SeatRequest } from './SeatRequest';

export class GameState extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>();
  // Never send deck order to players or spectators, including debug clients.
  @filter(() => false)
  @type([Card])
  deck = new ArraySchema<Card>();
  @type([Card]) discardPile = new ArraySchema<Card>();
  @type([Card]) table = new ArraySchema<Card>();
  @type([Card]) tableStacks = new ArraySchema<Card>(); // Pairs of [attacker, defender] for visual history
  @type([Card]) activeAttackCards = new ArraySchema<Card>(); // Specifically what the CURRENT defender must beat

  @type(Card) huzurCard: Card = new Card();
  @type('string') huzurSuit: string = '';

  @type('string') currentTurn: string = ''; // ID of the active player (attacker or defender)
  @type('number') defenseChainCount: number = 0; // 0 to 5 (tracks 6-player cycle)
  @type('string') phase: string = 'waiting'; // waiting, playing, finished
  @type('number') turnStartTime: number = 0; // Timestamp when current turn began (ms since epoch)
  @type('number') turnTimeLimit: number = 30000; // Time limit per turn in milliseconds (default 30s)

  @type('string') hostId: string = ''; // Tracks the lobby leader
  @type('number') maxPlayers: number = 6;
  @type('boolean') isPrivate: boolean = false;
  @type('string') mode: string = 'classic'; // classic, teams, etc.
  @type('string') teamSelection: string = 'random'; // random, manual
  @type('number') targetHandSize: number = 5;

  @type(['string']) seatOrder = new ArraySchema<string>(); // Used for turn progression and team alternating seats

  // The first player out once the deck is empty wins and the game ends there.
  // In Teams and Horse every member of that player's team is a winner.
  @type(['string']) winners = new ArraySchema<string>();
  @type('string') loser = ''; // Unused since the first-out rule: no single Durak is named.
  @type('string') outcome = ''; // '' while playing, then 'win' or 'draw'
  // Kept with the result: a departed winner's seat is released when the game ends.
  @type('string') winnerName = '';
  @type('number') winnerTeam: number = -1;

  // Issue #80: drive client-side 5s visibility window for newly played defense cards.
  // (Client compares Date.now() against this value.)
  @type('number') lastDefenseAt: number = 0;

  // Developer Mode: Full turn-by-turn game log for easy e2e test export
  // Replay includes initial hands and private draws; persistence remains server-side.
  @filter(() => false)
  @type(['string'])
  actionLog = new ArraySchema<string>();

  @type('number') spectatorCount: number = 0;

  // ── Horse (H-O-R-S-E) meta-match progression ──
  // One letter is added to a team's string every time they lose a sub-game.
  // First team to spell HORSE loses the meta-match.

  @type('string') horseTeamA: string = '';
  @type('string') horseTeamB: string = '';
  @type('number') horseGame: number = 1;

  @type('number') deckCount: number = 0;

  // Private-table lifecycle: server deadline (ms since epoch) for 'countdown'
  // and 'opening', and the public Suhuh reveals shown during the opening.
  @type('number') phaseEndsAt: number = 0;
  @type([OpeningDraw]) openingDraws = new ArraySchema<OpeningDraw>();
  // Watchers who asked to join, seated in order as seats open between games.
  @type([SeatRequest]) seatRequests = new ArraySchema<SeatRequest>();
}
