import { GAME_WIDTH, GAME_HEIGHT, config, weapons } from "../game.ts";

const PORT = (typeof Deno !== "undefined" && Deno.env.get("PORT")) ? Number(Deno.env.get("PORT")) : 8080;
const TICK_RATE = 30;
const WIND_SCALE = 20;

export {
  PORT,
  TICK_RATE,
  WIND_SCALE,
  GAME_WIDTH,
  GAME_HEIGHT,
  config,
  weapons,
};
