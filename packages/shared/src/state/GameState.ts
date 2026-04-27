import { type, Schema, MapSchema, ArraySchema } from "@colyseus/schema";
import { Player } from "./Player";
import { Card } from "./Card";

export class CardStack extends Schema {
  @type([ Card ]) cards = new ArraySchema<Card>();
}

export class GameState extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>();
  @type([ Card ]) deck = new ArraySchema<Card>();
  @type([ Card ]) discardPile = new ArraySchema<Card>();
  @type([ CardStack ]) tableStacks = new ArraySchema<CardStack>();
  @type([ Card ]) activeAttackCards = new ArraySchema<Card>(); // Specifically what the CURRENT defender must beat
  
  @type(Card) huzurCard: Card = new Card();
  @type("string") huzurSuit: string = "";
  
  @type("string") currentTurn: string = ""; // ID of the active player (attacker or defender)
  @type("number") defenseChainCount: number = 0; // 0 to 5 (tracks 6-player cycle)
  @type("string") phase: string = "waiting"; // waiting, playing, finished
  @type("number") turnStartTime: number = 0; // Timestamp when current turn began (ms since epoch)
  @type("number") turnTimeLimit: number = 30000; // Time limit per turn in milliseconds (default 30s)
  
  @type("number") maxPlayers: number = 6;
  @type("boolean") isPrivate: boolean = false;
  @type("string") mode: string = "classic"; // classic, teams, etc.
  @type("string") teamSelection: string = "random"; // random, manual
  @type("number") targetHandSize: number = 5;

  @type([ "string" ]) seatOrder = new ArraySchema<string>(); // Used for turn progression and team alternating seats
  
  @type([ "string" ]) winners = new ArraySchema<string>(); // List of sessionIds who finished their hand
  @type("string") loser = ""; // sessionId of the Durak

  // Issue #80: drive client-side 5s visibility window for newly played defense cards.
  // (Client compares Date.now() against this value.)
  @type("number") lastDefenseAt: number = 0;

  // Developer Mode: Full turn-by-turn game log for easy e2e test export
  @type([ "string" ]) actionLog = new ArraySchema<string>();
}
