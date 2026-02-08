import { PORT, TICK_RATE } from "./config.js";
import { resetGame, step } from "./game-logic.js";
import { broadcastState } from "./network.js";
import { handler } from "./http.js";

resetGame();

setInterval(() => {
  step(1 / TICK_RATE);
  broadcastState(false);
}, 1000 / TICK_RATE);

console.log(`Deno server running on port ${PORT}`);
// @ts-ignore
Deno.serve({ port: PORT }, handler);
