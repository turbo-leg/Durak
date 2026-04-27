import { Schema, type } from "@colyseus/schema";
class TestState extends Schema {
  @type("number") time: number = 0;
}
const state = new TestState();
state.time = Date.now();
const encoded = state.encodeAll();
const decoded = new TestState();
decoded.decode(encoded);
console.log("Original:", state.time, "Decoded:", decoded.time);
