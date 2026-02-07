import { PORT, TICK_RATE } from "./config.mjs";
import { resetGame, step } from "./game-logic.mjs";
import { broadcastState } from "./network.mjs";
import { handler } from "./http.mjs";

resetGame();

setInterval(() => {
  step(1 / TICK_RATE);
  broadcastState(false);
}, 1000 / TICK_RATE);

console.log(`Deno server running on port ${PORT}`);
Deno.serve({ port: PORT, handler });
