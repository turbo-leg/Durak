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
}
