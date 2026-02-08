import { PORT, TICK_RATE } from "./config.ts";
import { resetGame, step } from "./game-logic.ts";
import { broadcastState } from "./network.ts";
import { handler } from "./http.ts";

resetGame();

setInterval(() => {
  step(1 / TICK_RATE);
  broadcastState(false);
}, 1000 / TICK_RATE);

console.log(`Deno server running on port ${PORT}`);
// @ts-ignore
Deno.serve({ port: PORT }, handler);
