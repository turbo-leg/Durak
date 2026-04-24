import { type, Schema, MapSchema, ArraySchema } from "@colyseus/schema";
import { Player } from "./Player";
import { Card } from "./Card";

export class GameState extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>();
  @type([ Card ]) deck = new ArraySchema<Card>();
  @type([ Card ]) discardPile = new ArraySchema<Card>();
  @type([ Card ]) table = new ArraySchema<Card>();
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
}
