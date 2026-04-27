import { Schema, type } from "@colyseus/schema";
class TestState extends Schema {
  @type("number") time: number = 0;
}
const state = new TestState();
state.time = Date.now();
console.log(state.time, Date.now());
