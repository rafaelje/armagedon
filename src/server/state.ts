import { GAME_WIDTH, GAME_HEIGHT } from "../game.ts";
import { Worm, Projectile, GameState } from "../types.ts";
export { Worm, Projectile, GameState };

let seed = Math.floor(Math.random() * 1e9);
let nextId = 1;

export interface ClientInfo {
  id: string;
  team: string;
}

const clients = new Map<any, ClientInfo>();
const pressed = new Set<string>();

const state: GameState = {
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  terrain: [],
  worms: [],
  currentIndex: 0,
  weaponIndex: 0,
  projectiles: [],
  charging: false,
  charge: 0,
  chargeDir: 1,
  gameOver: false,
  winner: null,
  wind: 0,
  seed,
  turnTimer: 30,
  turnTimerMax: 30,
};

function getNextClientId() {
  return nextId++;
}

export {
  state,
  clients,
  pressed,
  getNextClientId
};
