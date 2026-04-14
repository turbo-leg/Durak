import { type, Schema, ArraySchema } from "@colyseus/schema";
import { Card } from "./Card";

export class Player extends Schema {
  @type("string") id: string = "";
  @type([ Card ]) hand = new ArraySchema<Card>();
  @type("boolean") hasPickedUp: boolean = false;
  @type("number") team: number = 0; // 0 or 1 for 3v3
  
  constructor(id: string = "") {
    super();
    this.id = id;
  }
}
