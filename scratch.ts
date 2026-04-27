import { Card, Player } from "./packages/shared/src/state/GameState";
import { DurakEngine } from "./packages/shared/src/engine/DurakEngine";

const p1 = new Player("1"); p1.hand.push(new Card("Spades", 14), new Card("Hearts", 15), new Card("Clubs", 10));
const p2 = new Player("2"); p2.hand.push(new Card("Spades", 14), new Card("Hearts", 15), new Card("Clubs", 10));

const cards = [new Card("Diamonds", 14), new Card("Diamonds", 15)];
console.log(DurakEngine.isValidMassAttack(cards, [p1, p2], 10, 5));
